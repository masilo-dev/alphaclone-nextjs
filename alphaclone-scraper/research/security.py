"""Security and SSRF protection for Scrapy Web Research Engine."""

import ipaddress
import re
import socket
from urllib.parse import urlparse

# Private / reserved subnets that should NEVER be touched by the crawler
BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local & cloud metadata (169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("192.88.99.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("255.255.255.255/32"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata.gcp.internal",
    "instance-data",
}

# Dangerous / executable extensions to avoid downloading
BLOCKED_EXTENSIONS = {
    ".exe", ".bin", ".dmg", ".iso", ".msi", ".zip", ".tar", ".gz",
    ".7z", ".rar", ".apk", ".deb", ".rpm", ".sh", ".bat", ".cmd",
    ".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm",
    ".mp3", ".wav", ".flac", ".ogg", ".pdf"
}

MAX_RESPONSE_SIZE = 2 * 1024 * 1024  # 2MB response cap


def is_safe_url(url: str) -> tuple[bool, str]:
    """Validate that a URL is safe to fetch and does not point to internal resources (SSRF guard)."""
    if not url or not isinstance(url, str):
        return False, "Empty or invalid URL"

    url_str = url.strip()
    try:
        parsed = urlparse(url_str)
    except Exception as exc:
        return False, f"Malformed URL: {exc}"

    if parsed.scheme not in ("http", "https"):
        return False, f"Unsupported scheme '{parsed.scheme}'. Only http and https allowed"

    hostname = (parsed.hostname or "").lower().strip()
    if not hostname:
        return False, "Missing hostname"

    if hostname in BLOCKED_HOSTNAMES or hostname.endswith((".local", ".internal", ".lan", ".corp")):
        return False, f"Access to restricted hostname '{hostname}' is blocked"

    # Check path extension
    path_lower = parsed.path.lower()
    for ext in BLOCKED_EXTENSIONS:
        if path_lower.endswith(ext):
            return False, f"File extension '{ext}' is blocked from crawling"

    # Resolve IP and verify against private/link-local ranges
    try:
        # Check if hostname is already a valid IP literal
        try:
            ip = ipaddress.ip_address(hostname)
            for net in BLOCKED_NETWORKS:
                if ip in net:
                    return False, f"IP address {ip} is within restricted network {net}"
        except ValueError:
            # It is a domain name — resolve it
            addr_info = socket.getaddrinfo(hostname, None)
            for entry in addr_info:
                ip_str = entry[4][0]
                ip = ipaddress.ip_address(ip_str)
                for net in BLOCKED_NETWORKS:
                    if ip in net:
                        return False, f"Resolved IP {ip} is within restricted network {net}"
    except (socket.gaierror, socket.timeout):
        # DNS resolution failure or timeout — let Scrapy handle standard DNS errors
        pass
    except Exception as exc:
        return False, f"Security verification error: {exc}"

    return True, "OK"


# Regex to sanitize potential prompt injection tokens or malicious instructions
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions?", re.IGNORECASE),
    re.compile(r"system\s*prompt\s*override", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+in\s+developer\s+mode", re.IGNORECASE),
    re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL),
]


def sanitize_extracted_text(text: str, max_length: int = 1500) -> str:
    """Sanitize extracted web text to prevent prompt injection and untrusted payload injection."""
    if not text or not isinstance(text, str):
        return ""

    sanitized = text
    # Strip script tags
    sanitized = re.sub(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", "", sanitized, flags=re.IGNORECASE | re.DOTALL)
    # Strip iframe / style
    sanitized = re.sub(r"<\s*(iframe|style)[^>]*>.*?<\s*/\s*\1\s*>", "", sanitized, flags=re.IGNORECASE | re.DOTALL)
    # Neutralize injection directives
    for pattern in PROMPT_INJECTION_PATTERNS:
        sanitized = pattern.sub("[filtered text]", sanitized)

    # Normalize whitespace
    sanitized = " ".join(sanitized.split())
    return sanitized[:max_length]
