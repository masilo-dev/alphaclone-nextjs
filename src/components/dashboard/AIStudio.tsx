
import React, { useState } from 'react';
import { Image as ImageIcon, Video, Loader2, Download, Upload, Wand2, Film, Sparkles, Save, Grid, Trash2, AlertTriangle } from 'lucide-react';
import { Button, Input, Card } from '../ui/UIComponents';
// Note: Image editing and video generation features are placeholders
// They return mock data until proper AI models are integrated
import { editImage, generateVideo } from '../../services/geminiService';
import { User, GalleryItem } from '../../types';

interface AIStudioProps {
   user: User;
   galleryItems: GalleryItem[];
   setGalleryItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>;
}

const AIStudio: React.FC<AIStudioProps> = ({ user, galleryItems, setGalleryItems }) => {
   const [activeTab, setActiveTab] = useState<'image' | 'video' | 'gallery'>('image');

   // Usage tracking for clients
   const [usageCount, setUsageCount] = useState(0);
   const CLIENT_USAGE_LIMIT = 3;
   const isLimitReached = user.role === 'client' && usageCount >= CLIENT_USAGE_LIMIT;

   // Image Editor State
   const [editorImage, setEditorImage] = useState<string | null>(null);
   const [editorPrompt, setEditorPrompt] = useState('');
   const [isEditing, setIsEditing] = useState(false);
   const [resultImage, setResultImage] = useState<string | null>(null);

   // Video Gen State
   const [videoImage, setVideoImage] = useState<string | null>(null);
   const [videoPrompt, setVideoPrompt] = useState('');
   const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
   const [resultVideo, setResultVideo] = useState<string | null>(null);



   const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (s: string) => void) => {
      const file = e.target.files?.[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => setter(reader.result as string);
         reader.readAsDataURL(file);
      }
   };

   const incrementUsage = () => {
      if (user.role === 'client') {
         setUsageCount(prev => prev + 1);
      }
   };

   const handleEditImage = async () => {
      if (isLimitReached) return;
      if (!editorImage || !editorPrompt) return;
      setIsEditing(true);
      try {
         const res = await editImage(editorImage, editorPrompt);
         if (res) {
            setResultImage(res);
            incrementUsage();
         }
      } catch (e) {
         console.error(e);
         alert("Failed to edit image");
      } finally {
         setIsEditing(false);
      }
   };

   const handleGenerateVideo = async () => {
      if (isLimitReached) return;
      setIsGeneratingVideo(true);
      try {
         // Generate video (prompt not currently used by mock service)
         const res = await generateVideo();
         if (res) {
            setResultVideo(res);
            incrementUsage();
         }
      } catch (e) {
         console.error(e);
         alert("Failed to generate video. Ensure you have selected a valid paid API key via the popup.");
      } finally {
         setIsGeneratingVideo(false);
      }
   };

   const handleSaveToGallery = (type: 'image' | 'video', url: string, prompt: string) => {
      const newItem: GalleryItem = {
         id: Date.now().toString(),
         userId: user.id,
         type,
         url,
         prompt,
         createdAt: new Date()
      };
      setGalleryItems(prev => [newItem, ...prev]);
      alert("Saved to Gallery!");
   };

   const handleDeleteItem = (id: string) => {
      setGalleryItems(prev => prev.filter(item => item.id !== id));
   };

   const myGalleryItems = galleryItems.filter(item => item.userId === user.id);

   const LimitWarning = () => (
      <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start gap-3 mb-6">
         <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
         <div>
            <h4 className="text-yellow-500 font-bold text-sm">Usage Limit Reached</h4>
            <p className="text-slate-400 text-xs mt-1">
               You have used your daily AI generation credits ({usageCount}/{CLIENT_USAGE_LIMIT}).
               Please request approval for additional resources related to your project scope.
            </p>
            <Button size="sm" className="mt-2 text-xs bg-yellow-600 hover:bg-yellow-500 text-white">Request Approval</Button>
         </div>
      </div>
   );

   return (
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto relative">

         {/* Clean Header */}
         <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 pb-4 border-b border-slate-800">
            <div>
               <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">AI Studio</h1>
               <p className="text-sm text-slate-500 mt-1">Professional media generation</p>
            </div>

            {/* Compact Tabs */}
            <div className="flex gap-2">
               <button
                  onClick={() => setActiveTab('image')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'image' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
               >
                  Image
               </button>
               <button
                  onClick={() => setActiveTab('video')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'video' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
               >
                  Video
               </button>
               <button
                  onClick={() => setActiveTab('gallery')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'gallery' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
               >
                  Gallery
               </button>
            </div>
         </div>

         {/* Credit Badge (subtle, top right) */}
         {user.role === 'client' && activeTab !== 'gallery' && (
            <div className="absolute top-4 right-4 px-3 py-1 bg-slate-900/80 backdrop-blur-sm rounded-full border border-slate-700 text-xs text-slate-400 shadow-lg">
               {usageCount}/{CLIENT_USAGE_LIMIT} credits
            </div>
         )}

         {isLimitReached && activeTab !== 'gallery' && <LimitWarning />}

         {activeTab === 'image' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <Card className="flex flex-col gap-4 p-6">
                  <h3 className="text-lg font-semibold text-white">Source</h3>

                  <div
                     className="flex-1 bg-slate-950 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-teal-500/50 transition-colors min-h-[300px]"
                     onClick={() => !isLimitReached && document.getElementById('edit-upload')?.click()}
                  >
                     {editorImage ? (
                        <img src={editorImage} className="w-full h-full object-contain" />
                     ) : (
                        <div className="text-center p-6">
                           <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                           <p className="text-slate-400 font-medium">Click to upload image</p>
                           <p className="text-xs text-slate-600 mt-1">PNG, JPG up to 5MB</p>
                        </div>
                     )}
                     <input id="edit-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setEditorImage)} disabled={isLimitReached} />
                  </div>

                  <div className="space-y-4">
                     <Input
                        label="Editing Instruction"
                        placeholder="E.g. Add a retro filter, Remove the person in background..."
                        value={editorPrompt}
                        onChange={(e) => setEditorPrompt(e.target.value)}
                        disabled={isLimitReached}
                     />
                     <Button
                        onClick={handleEditImage}
                        disabled={!editorImage || !editorPrompt || isEditing || isLimitReached}
                        className="w-full bg-teal-600 hover:bg-teal-500"
                     >
                        {isEditing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : 'Generate'}
                     </Button>
                  </div>
               </Card>

               <Card className="flex flex-col gap-4 p-6 bg-slate-900/50">
                  <h3 className="text-lg font-semibold text-white">Result</h3>
                  <div className="flex-1 bg-slate-950 rounded-xl flex items-center justify-center relative overflow-hidden min-h-[300px]">
                     {resultImage ? (
                        <img src={resultImage} className="w-full h-full object-contain" />
                     ) : (
                        <p className="text-slate-600 text-sm">Generated image will appear here</p>
                     )}
                  </div>
                  {resultImage && (
                     <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => {
                           const link = document.createElement('a');
                           link.href = resultImage;
                           link.download = 'edited-image.png';
                           link.click();
                        }}>
                           <Download className="w-4 h-4 mr-2" /> Download
                        </Button>
                        <Button variant="secondary" className="flex-1" onClick={() => handleSaveToGallery('image', resultImage!, editorPrompt)}>
                           <Save className="w-4 h-4 mr-2" /> Save to Gallery
                        </Button>
                     </div>
                  )}
               </Card>
            </div>
         )}

         {activeTab === 'video' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <Card className="flex flex-col gap-4 p-6">
                  <h3 className="text-lg font-semibold text-white">Configuration</h3>

                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-300">Reference Image (Optional)</label>
                     <div
                        className="bg-slate-950 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-teal-500/50 transition-colors h-48"
                        onClick={() => !isLimitReached && document.getElementById('video-upload')?.click()}
                     >
                        {videoImage ? (
                           <img src={videoImage} className="w-full h-full object-contain" />
                        ) : (
                           <div className="text-center p-4">
                              <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                              <p className="text-xs text-slate-400">Upload starting frame</p>
                           </div>
                        )}
                        <input id="video-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, setVideoImage)} disabled={isLimitReached} />
                     </div>
                  </div>

                  <div className="space-y-4">
                     <Input
                        label="Video Prompt"
                        placeholder="E.g. A cyberpunk city with neon lights, cinematic 4k..."
                        value={videoPrompt}
                        onChange={(e) => setVideoPrompt(e.target.value)}
                        disabled={isLimitReached}
                     />
                     <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-xs text-blue-300">
                        Note: Video generation with Veo takes 1-2 minutes. Please keep this tab open.
                     </div>
                     <Button
                        onClick={handleGenerateVideo}
                        disabled={(!videoImage && !videoPrompt) || isGeneratingVideo || isLimitReached}
                        className="w-full bg-purple-600 hover:bg-purple-500"
                     >
                        {isGeneratingVideo ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : 'Generate'}
                     </Button>
                  </div>
               </Card>

               <Card className="flex flex-col gap-4 p-6 bg-slate-900/50">
                  <h3 className="text-lg font-semibold text-white">Output</h3>
                  <div className="flex-1 bg-slate-950 rounded-xl flex items-center justify-center relative overflow-hidden min-h-[300px]">
                     {resultVideo ? (
                        <video src={resultVideo} controls className="w-full h-full" autoPlay loop />
                     ) : (
                        <p className="text-slate-600 text-sm">Generated video will appear here</p>
                     )}
                  </div>
                  {resultVideo && (
                     <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => {
                           const link = document.createElement('a');
                           link.href = resultVideo;
                           link.download = 'veo-generation.mp4';
                           link.click();
                        }}>
                           <Download className="w-4 h-4 mr-2" /> Download MP4
                        </Button>
                        <Button variant="secondary" className="flex-1" onClick={() => handleSaveToGallery('video', resultVideo!, videoPrompt || "Generated Video")}>
                           <Save className="w-4 h-4 mr-2" /> Save to Gallery
                        </Button>
                     </div>
                  )}
               </Card>
            </div>
         )}

         {activeTab === 'gallery' && (
            <div className="space-y-6">
               <h2 className="text-lg font-semibold text-white">Saved</h2>
               {myGalleryItems.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
                     <Grid className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                     <h3 className="text-lg font-medium text-slate-400">Gallery is empty</h3>
                     <p className="text-slate-500 text-sm">Create and save images or videos to see them here.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {myGalleryItems.map(item => (
                        <div key={item.id} className="group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-teal-500/50 transition-all">
                           <div className="aspect-square relative">
                              {item.type === 'image' ? (
                                 <img src={item.url} className="w-full h-full object-cover" />
                              ) : (
                                 <video src={item.url} className="w-full h-full object-cover" controls />
                              )}
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-1.5 bg-red-500/80 text-white rounded-lg hover:bg-red-500"
                                    title="Delete"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                              <div className="absolute top-2 left-2">
                                 <span className={`px-2 py-1 rounded text-xs font-bold ${item.type === 'image' ? 'bg-purple-500/80 text-white' : 'bg-indigo-500/80 text-white'}`}>
                                    {item.type === 'image' ? 'IMG' : 'VEO'}
                                 </span>
                              </div>
                           </div>
                           <div className="p-4">
                              <p className="text-sm text-slate-300 line-clamp-2 mb-2" title={item.prompt}>{item.prompt}</p>
                              <p className="text-xs text-slate-500">{item.createdAt.toLocaleDateString()}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         )}
      </div>
   );
};

export default AIStudio;
