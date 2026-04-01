import React from 'react';

interface LoomVideoProps {
    videoId: string;
    title?: string;
}

const LoomVideo: React.FC<LoomVideoProps> = ({ videoId, title }) => {
    return (
        <div className="relative w-full bg-slate-900 overflow-hidden rounded-2xl border border-slate-700/50 shadow-2xl shadow-black/40"
             style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
            <iframe
                src={`https://www.loom.com/embed/${videoId}?hide_owner=true&hide_share=true&hide_title=true&hide_embed_speed=true`}
                title={title || "Loom Video"}
                className="absolute top-0 left-0 w-full h-full"
                loading="lazy"
                allowFullScreen
            />
        </div>
    );
};

export default LoomVideo;
