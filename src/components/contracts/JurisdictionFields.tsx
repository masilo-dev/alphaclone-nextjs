import React, { useState } from 'react';
import { EU_JURISDICTIONS } from '@/config/euJurisdictions';
import { useLanguage } from '@/contexts/LanguageContext';

export const CONTRACT_INPUT_CLASS =
    'w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all text-sm';
export const CONTRACT_LABEL_CLASS = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

const CUSTOM = '__custom__';

interface JurisdictionFieldsProps {
    jurisdiction: string;
    governingLaw: string;
    onChange: (next: { jurisdiction: string; governingLaw: string }) => void;
    required?: boolean;
    /** Show a one-line hint under the fields (e.g. why they are required). */
    hint?: string;
}

/**
 * Governing jurisdiction + governing law pair used by the contract form, the
 * signer profile and the send modal. Picking an EU/EEA country fills the law
 * automatically; "Other" lets the owner type any jurisdiction (e.g. a US state).
 */
export const JurisdictionFields: React.FC<JurisdictionFieldsProps> = ({ jurisdiction, governingLaw, onChange, required = false, hint }) => {
    const { t } = useLanguage();
    const isListed = EU_JURISDICTIONS.some((j) => j.label === jurisdiction);
    const [customMode, setCustomMode] = useState(false);
    const showCustomInput = customMode || (Boolean(jurisdiction) && !isListed);
    const selectValue = showCustomInput ? CUSTOM : jurisdiction;

    return (
        <>
            <div>
                <label className={CONTRACT_LABEL_CLASS}>
                    {t('Governing Jurisdiction')}{required ? ' *' : ''}
                </label>
                <select
                    className={CONTRACT_INPUT_CLASS}
                    value={selectValue}
                    onChange={(e) => {
                        const value = e.target.value;
                        if (value === CUSTOM) {
                            setCustomMode(true);
                            onChange({ jurisdiction: isListed ? '' : jurisdiction, governingLaw: isListed ? '' : governingLaw });
                            return;
                        }
                        setCustomMode(false);
                        const picked = EU_JURISDICTIONS.find((j) => j.label === value);
                        onChange({ jurisdiction: value, governingLaw: picked ? picked.governingLaw : governingLaw });
                    }}
                >
                    <option value="">{t('— Select EU / EEA jurisdiction —')}</option>
                    {EU_JURISDICTIONS.map((j) => (
                        <option key={j.code} value={j.label}>{j.label}</option>
                    ))}
                    <option value={CUSTOM}>{t('Other (type below)')}</option>
                </select>
                {showCustomInput && (
                    <input
                        className={`${CONTRACT_INPUT_CLASS} mt-2`}
                        value={jurisdiction}
                        onChange={(e) => onChange({ jurisdiction: e.target.value, governingLaw })}
                        placeholder={t('e.g. State of Wyoming, USA')}
                    />
                )}
            </div>
            <div>
                <label className={CONTRACT_LABEL_CLASS}>
                    {t('Governing Law')}{required ? ' *' : ''}
                </label>
                <input
                    className={CONTRACT_INPUT_CLASS}
                    value={governingLaw}
                    onChange={(e) => onChange({ jurisdiction, governingLaw: e.target.value })}
                    placeholder={t('e.g. Laws of the State of Wyoming')}
                />
                {hint && <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">{hint}</p>}
            </div>
        </>
    );
};
