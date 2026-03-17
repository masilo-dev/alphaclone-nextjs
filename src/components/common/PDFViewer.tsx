import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, ZoomIn, ZoomOut, RotateCw, X, Eye, RefreshCw } from 'lucide-react';
import { Button } from '../ui/UIComponents';

interface PDFViewerProps {
  fileUrl: string;
  fileName?: string;
  onClose?: () => void;
  onDownload?: () => void;
  className?: string;
  height?: string | number;
  width?: string | number;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  fileUrl,
  fileName = 'document.pdf',
  onClose,
  onDownload,
  className = '',
  height = '600px',
  width = '100%'
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPDF();
  }, [fileUrl]);

  const loadPDF = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate URL
      if (!fileUrl || !isValidUrl(fileUrl)) {
        throw new Error('Invalid PDF URL provided');
      }

      // Fetch the PDF file
      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Validate that it's actually a PDF
      if (blob.type !== 'application/pdf' && !fileUrl.toLowerCase().endsWith('.pdf')) {
        throw new Error('File is not a valid PDF');
      }

      setPdfBlob(blob);
      
      // Create object URL for the blob
      const objectUrl = URL.createObjectURL(blob);
      
      // Set up iframe with proper sandboxing
      if (iframeRef.current) {
        iframeRef.current.src = objectUrl;
        iframeRef.current.onload = () => {
          setIsLoading(false);
          // Clean up object URL after iframe loads
          URL.revokeObjectURL(objectUrl);
        };
        iframeRef.current.onerror = () => {
          setError('Failed to load PDF in viewer');
          setIsLoading(false);
          URL.revokeObjectURL(objectUrl);
        };
      }

    } catch (error) {
      console.error('PDF loading error:', error);
      setError(error instanceof Error ? error.message : 'Failed to load PDF');
      setIsLoading(false);
    }
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownload = () => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleRefresh = () => {
    loadPDF();
  };

  const handlePrint = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.print();
      } catch (error) {
        console.error('Print error:', error);
        // Fallback: open in new window for printing
        window.open(fileUrl, '_blank');
      }
    }
  };

  if (error) {
    return (
      <div className={`bg-slate-800 border border-slate-700 rounded-lg p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center text-center">
          <FileText className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Failed to Load PDF</h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            {onClose && (
              <Button
                onClick={onClose}
                variant="outline"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-teal-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">{fileName}</h3>
            <p className="text-xs text-slate-400">PDF Document</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <Button
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="bg-slate-700 hover:bg-slate-600"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-slate-400 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="bg-slate-700 hover:bg-slate-600"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          {/* Rotate */}
          <Button
            size="sm"
            onClick={handleRotate}
            className="bg-slate-700 hover:bg-slate-600"
          >
            <RotateCw className="w-4 h-4" />
          </Button>

          {/* Print */}
          <Button
            size="sm"
            onClick={handlePrint}
            className="bg-slate-700 hover:bg-slate-600"
          >
            <Eye className="w-4 h-4" />
          </Button>

          {/* Download */}
          <Button
            size="sm"
            onClick={handleDownload}
            className="bg-slate-700 hover:bg-slate-600"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Refresh */}
          <Button
            size="sm"
            onClick={handleRefresh}
            className="bg-slate-700 hover:bg-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Close */}
          {onClose && (
            <Button
              size="sm"
              onClick={onClose}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* PDF Container */}
      <div 
        ref={containerRef}
        className="relative bg-slate-900"
        style={{ 
          height: typeof height === 'number' ? `${height}px` : height,
          width: typeof width === 'number' ? `${width}px` : width,
          minHeight: '400px',
          minWidth: '300px'
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-teal-400 mx-auto mb-4" />
              <p className="text-slate-400">Loading PDF...</p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-in-out'
          }}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          allowFullScreen
          title={fileName}
        />
      </div>

      {/* Footer with additional controls */}
      <div className="flex items-center justify-between p-3 bg-slate-700/50 border-t border-slate-700">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Page {currentPage} of {totalPages}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            className="bg-slate-600 hover:bg-slate-500"
          >
            Previous
          </Button>
          <Button
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="bg-slate-600 hover:bg-slate-500"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;