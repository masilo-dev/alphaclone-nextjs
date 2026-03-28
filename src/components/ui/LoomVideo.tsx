import React from 'react';

interface LoomVideoProps {
    videoId: string;
    title?: string;
}

const LoomVideo: React.FC<LoomVideoProps> = ({ videoId, title }) => {
    return (
        <div className="relative w-full h-full min-h-[200px] bg-slate-900 overflow-hidden rounded-xl">
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
