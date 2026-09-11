'use client';

import {
  Input,
  InputGroup,
  InputLeftElement,
  useColorModeValue,
} from '@chakra-ui/react';
import { Search } from 'lucide-react';

/**
 * Search bar component for the dashboard header.
 */
export function SearchBar() {
  const bgInput = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <InputGroup maxW="300px" size="sm">
      <InputLeftElement pointerEvents="none">
        <Search size={16} />
      </InputLeftElement>
      <Input
        placeholder="Search..."
        bg={bgInput}
        borderColor={borderColor}
        borderRadius="lg"
        _focus={{ borderColor: 'brand.500' }}
      />
    </InputGroup>
  );
}
