import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface TabBarIconProps {
  name: string;
  color: string;
  size: number;
}

export default function TabBarIcon({ name, color, size }: TabBarIconProps) {
  return <Ionicons name={name as any} size={size} color={color} />;
}