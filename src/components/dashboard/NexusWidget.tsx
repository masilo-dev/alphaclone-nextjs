'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'What are my top deals this week?',
  'Show me overdue invoices',
  'Summarize recent activity',
  'Which clients need follow-up?',
];

/**
 * Nexus AI floating widget with chat interface.
 * Integrates with MCP API for AI-powered responses.
 */
export function NexusWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const bgCard = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');
  const assistantBg = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || 'I apologize, but I could not process that request.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}
          >
            <IconButton
              aria-label="Open Nexus AI"
              icon={<Sparkles size={24} />}
              colorScheme="brand"
              size="lg"
              borderRadius="full"
              boxShadow="lg"
              onClick={() => setIsOpen(true)}
              _hover={{ transform: 'scale(1.1)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <Drawer
        isOpen={isOpen}
        placement="right"
        onClose={() => setIsOpen(false)}
        size="sm"
      >
        <DrawerOverlay />
        <DrawerContent bg={bgCard}>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" borderColor={borderColor}>
            <Flex align="center" gap={2}>
              <Sparkles size={20} />
              <Text color={textColor}>Nexus AI</Text>
            </Flex>
          </DrawerHeader>

          <DrawerBody display="flex" flexDirection="column" p={0}>
            {/* Messages */}
            <VStack
              flex={1}
              overflowY="auto"
              p={4}
              spacing={3}
              align="stretch"
            >
              {messages.length === 0 && (
                <Box textAlign="center" py={8} color="gray.500">
                  <Sparkles size={40} style={{ margin: '0 auto', marginBottom: '12px', opacity: 0.5 }} />
                  <Text fontSize="sm">Ask me anything about your business</Text>
                </Box>
              )}

              {messages.map((msg, idx) => (
                <Box
                  key={idx}
                  alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                  maxW="80%"
                >
                  <Box
                    p={3}
                    borderRadius="lg"
                    bg={
                      msg.role === 'user'
                        ? 'brand.500'
                        : assistantBg
                    }
                    color={msg.role === 'user' ? 'white' : textColor}
                  >
                    <Text fontSize="sm">{msg.content}</Text>
                  </Box>
                </Box>
              ))}

              {isLoading && (
                <Box alignSelf="flex-start">
                  <Box
                    p={3}
                    borderRadius="lg"
                  bg={assistantBg}
                  >
                    <Text fontSize="sm" color="gray.500">
                      Thinking...
                    </Text>
                  </Box>
                </Box>
              )}

              <div ref={messagesEndRef} />
            </VStack>

            {/* Suggested prompts */}
            {messages.length === 0 && (
              <Box px={4} pb={2}>
                <Text fontSize="xs" color="gray.500" mb={2}>
                  Try asking:
                </Text>
                <Flex wrap="wrap" gap={2}>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <Button
                      key={prompt}
                      size="xs"
                      variant="outline"
                      onClick={() => sendMessage(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </Flex>
              </Box>
            )}

            {/* Input */}
            <Box p={4} borderTopWidth="1px" borderColor={borderColor}>
              <InputGroup size="md">
                <Input
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  borderRadius="lg"
                  pr="4.5rem"
                />
                <InputRightElement width="4.5rem">
                  <Button
                    h="1.75rem"
                    size="sm"
                    onClick={() => sendMessage(input)}
                    isLoading={isLoading}
                    colorScheme="brand"
                  >
                    <Send size={16} />
                  </Button>
                </InputRightElement>
              </InputGroup>
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
