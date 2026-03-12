import React, { useState } from 'react';
import { Palette, X, Check } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

interface BackgroundColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

const presetColors = [
  '#0f172a', // slate-950 (default)
  '#1e293b', // slate-800
  '#334155', // slate-700
  '#1f2937', // gray-800
  '#374151', // gray-700
  '#4b5563', // gray-600
  '#1e40af', // blue-800
  '#1d4ed8', // blue-700
  '#0c4a6e', // sky-900
  '#0f766e', // teal-700
  '#064e3b', // emerald-900
  '#7c2d12', // orange-900
  '#991b1b', // red-800
  '#7c3aed', // violet-600
  '#581c87', // purple-900
];

export const BackgroundColorPicker: React.FC<BackgroundColorPickerProps> = ({ isOpen, onClose }) => {
  const { backgroundColor, setBackgroundColor, resetToDefault } = useTheme();
  const [customColor, setCustomColor] = useState('');

  if (!isOpen) return null;

  const handleColorSelect = (color: string) => {
    setBackgroundColor(color);
  };

  const handleCustomColorSubmit = () => {
    if (customColor.match(/^#[0-9A-F]{6}$/i)) {
      setBackgroundColor(customColor);
      setCustomColor('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-teal-400" />
            <h3 className="text-lg font-semibold text-white">Dashboard Background</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Preset Colors</h4>
            <div className="grid grid-cols-5 gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                    backgroundColor === color 
                      ? 'border-teal-400 ring-2 ring-teal-400/50' 
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Custom Color</h4>
            <div className="flex gap-2">
              <input
                type="color"
                value={customColor || backgroundColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-slate-600 bg-slate-700 cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#123ABC"
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                onClick={handleCustomColorSubmit}
                disabled={!customColor.match(/^#[0-9A-F]{6}$/i)}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={resetToDefault}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Reset to Default
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};