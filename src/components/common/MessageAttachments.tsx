'use client';

import React from 'react';
import { X, FileText, Image, Video, Music, Download, Eye } from 'lucide-react';

interface MessageAttachmentsProps {
  files: File[];
  onRemove: (index: number) => void;
  onPreview?: (file: File) => void;
}

const getFileIcon = (file: File) => {
  const type = file.type.split('/')[0];
  switch (type) {
    case 'image': return <Image className="w-4 h-4" />;
    case 'video': return <Video className="w-4 h-4" />;
    case 'audio': return <Music className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function MessageAttachments({ files, onRemove, onPreview }: MessageAttachmentsProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
        >
          <div className="flex-shrink-0 text-gray-500">
            {getFileIcon(file)}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {file.name}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(file.size)}
            </p>
          </div>

          <div className="flex items-center space-x-1">
            {file.type.startsWith('image/') && onPreview && (
              <button
                onClick={() => onPreview(file)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                title="Preview"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={() => onRemove(index)}
              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}