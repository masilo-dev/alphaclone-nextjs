import React, { useState } from 'react';
import { Palette, X, Check } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

interface BackgroundColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

const presetColors = [
  'var(--ws-canvas)', // slate-950 (default)
  'var(--ws-panel)', // slate-800
  'var(--ws-surface-tertiary)', // slate-700
  'var(--ws-panel)', // gray-800
  'var(--ws-surface-tertiary)', // gray-700
  'var(--ws-text-muted)', // gray-600
  'var(--info-700)', // blue-800
  'var(--info-700)', // blue-700
  'var(--info-700)', // sky-900
  'var(--brand-blue-700)', // teal-700
  'var(--success-700)', // emerald-900
  'var(--warning-700)', // orange-900
  'var(--error-700)', // red-800
  'var(--brand-violet-500)', // violet-600
  'var(--brand-violet-700)', // purple-900
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
      <div className="bg-[var(--ws-surface-secondary)] rounded-xl border border-[var(--ws-border)] p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-teal-400" />
            <h3 className="text-lg font-semibold text-[var(--ws-text-primary)]">Dashboard Background</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--ws-surface-tertiary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="type-ui font-medium text-[var(--ws-text-secondary)] mb-3">Preset Colors</h4>
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
            <h4 className="type-ui font-medium text-[var(--ws-text-secondary)] mb-3">Custom Color</h4>
            <div className="flex gap-2">
              <input
                type="color"
                value={customColor || backgroundColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-slate-600 bg-[var(--ws-surface-tertiary)] cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#123ABC"
                className="flex-1 px-3 py-2 bg-[var(--ws-surface-tertiary)] border border-slate-600 rounded-lg text-[var(--ws-text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                onClick={handleCustomColorSubmit}
                disabled={!customColor.match(/^#[0-9A-F]{6}$/i)}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-[var(--text-inverse)] rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-[var(--ws-border)]">
            <button
              onClick={resetToDefault}
              className="flex-1 px-4 py-2 bg-[var(--ws-surface-tertiary)] hover:bg-slate-600 text-[var(--ws-text-primary)] rounded-lg transition-colors"
            >
              Reset to Default
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-[var(--text-inverse)] rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};