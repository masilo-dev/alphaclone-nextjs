'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    FileText,
    Edit3,
    Download,
    Upload,
    Save,
    Bold,
    Italic,
    Underline,
    AlignLeft,
    AlignCenter,
    AlignRight,
    List,
    ListOrdered,
    Heading,
    Type,
    Palette,
    Plus,
    Trash2,
    Eye,
    Share2,
    Copy,
    RefreshCw,
    Search,
    Filter,
    Clock,
    Star,
    Folder,
    File,
    Image,
    Link,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../ui/UIComponents';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import toast from 'react-hot-toast';

interface Document {
    id: string;
    title: string;
    content: string;
    type: 'document' | 'template' | 'draft';
    category: string;
    tags: string[];
    isPublic: boolean;
    isTemplate: boolean;
    createdAt: string;
    updatedAt: string;
    version: number;
    author: {
        id: string;
        name: string;
        email: string;
    };
    collaborators: string[];
    wordCount: number;
    readingTime: number;
}

interface DocumentTemplate {
    id: string;
    name: string;
    description: string;
    content: string;
    category: string;
    tags: string[];
    isPremium: boolean;
    thumbnail: string;
}

const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
    {
        id: 'business-proposal',
        name: 'Business Proposal',
        description: 'Professional business proposal template',
        content: `<h1>Business Proposal</h1>
<p><strong>Prepared for:</strong> [Client Name]</p>
<p><strong>Prepared by:</strong> [Your Company]</p>
<p><strong>Date:</strong> [Current Date]</p>

<h2>Executive Summary</h2>
<p>This proposal outlines our comprehensive solution for your business needs...</p>

<h2>Project Overview</h2>
<p>We propose to deliver the following services:</p>
<ul>
<li>Service 1: Description and benefits</li>
<li>Service 2: Description and benefits</li>
<li>Service 3: Description and benefits</li>
</ul>

<h2>Timeline & Deliverables</h2>
<p>Our proposed timeline includes key milestones and deliverables...</p>

<h2>Pricing</h2>
<p>Our comprehensive solution is priced at [Amount] with the following breakdown...</p>`,
        category: 'Business',
        tags: ['business', 'proposal', 'professional'],
        isPremium: false,
        thumbnail: '📄'
    },
    {
        id: 'project-report',
        name: 'Project Report',
        description: 'Comprehensive project status report template',
        content: `<h1>Project Status Report</h1>
<p><strong>Project Name:</strong> [Project Name]</p>
<p><strong>Report Date:</strong> [Date]</p>
<p><strong>Project Manager:</strong> [Name]</p>

<h2>Executive Summary</h2>
<p>Provide a brief overview of the project status and key achievements...</p>

<h2>Project Progress</h2>
<p><strong>Overall Progress:</strong> [X]% Complete</p>
<p><strong>Key Milestones:</strong></p>
<ul>
<li>Milestone 1: Status</li>
<li>Milestone 2: Status</li>
<li>Milestone 3: Status</li>
</ul>

<h2>Issues & Risks</h2>
<p>Document any current issues or potential risks...</p>

<h2>Next Steps</h2>
<p>Outline the planned activities for the next reporting period...</p>`,
        category: 'Project Management',
        tags: ['project', 'report', 'status'],
        isPremium: false,
        thumbnail: '📊'
    },
    {
        id: 'meeting-minutes',
        name: 'Meeting Minutes',
        description: 'Professional meeting minutes template',
        content: `<h1>Meeting Minutes</h1>
<p><strong>Meeting Title:</strong> [Meeting Title]</p>
<p><strong>Date:</strong> [Date]</p>
<p><strong>Time:</strong> [Start Time] - [End Time]</p>
<p><strong>Location:</strong> [Location/Virtual]</p>

<h2>Attendees</h2>
<ul>
<li>[Name] - [Role]</li>
<li>[Name] - [Role]</li>
<li>[Name] - [Role]</li>
</ul>

<h2>Agenda Items</h2>
<h3>Item 1: [Topic]</h3>
<p><strong>Discussion:</strong> [Summary of discussion]</p>
<p><strong>Decision:</strong> [Any decisions made]</p>
<p><strong>Action Items:</strong></p>
<ul>
<li>[Action item] - Assigned to: [Name] - Due: [Date]</li>
</ul>

<h3>Item 2: [Topic]</h3>
<p>[Continue with additional agenda items...]</p>

<h2>Next Meeting</h2>
<p><strong>Date:</strong> [Next Meeting Date]</p>
<p><strong>Time:</strong> [Time]</p>
<p><strong>Agenda:</strong> [Preliminary agenda items]</p>`,
        category: 'Meeting',
        tags: ['meeting', 'minutes', 'notes'],
        isPremium: true,
        thumbnail: '📝'
    },
    {
        id: 'contract-agreement',
        name: 'Contract Agreement',
        description: 'Professional contract template',
        content: `<h1>Service Agreement</h1>
<p><strong>Contract Number:</strong> [Contract Number]</p>
<p><strong>Date:</strong> [Date]</p>

<h2>Parties</h2>
<p><strong>Client:</strong> [Client Name and Address]</p>
<p><strong>Service Provider:</strong> [Your Company Name and Address]</p>

<h2>Scope of Work</h2>
<p>The Service Provider agrees to provide the following services:</p>
<ul>
<li>[Detailed description of services]</li>
<li>[Deliverables and timelines]</li>
<li>[Quality standards and requirements]</li>
</ul>

<h2>Payment Terms</h2>
<p><strong>Total Contract Value:</strong> [Amount]</p>
<p><strong>Payment Schedule:</strong></p>
<ul>
<li>Deposit: [Amount] due upon signing</li>
<li>Milestone 1: [Amount] due [Date]</li>
<li>Final Payment: [Amount] due upon completion</li>
</ul>

<h2>Terms and Conditions</h2>
<p>Include relevant terms, conditions, and legal provisions...</p>`,
        category: 'Legal',
        tags: ['contract', 'agreement', 'legal'],
        isPremium: true,
        thumbnail: '📋'
    }
];

export default function EnhancedDocumentSystem() {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editorContent, setEditorContent] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [showPreview, setShowPreview] = useState(false);
    const [wordCount, setWordCount] = useState(0);
    const [readingTime, setReadingTime] = useState(0);

    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadDocuments();
    }, [user?.id]);

    useEffect(() => {
        if (editorContent) {
            const words = editorContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
            setWordCount(words);
            setReadingTime(Math.ceil(words / 200)); // Average reading speed: 200 words per minute
        }
    }, [editorContent]);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            // Simulate loading documents from API
            const mockDocuments: Document[] = [
                {
                    id: '1',
                    title: 'Business Proposal - AlphaClone Systems',
                    content: '<h1>Business Proposal</h1><p>This is a comprehensive business proposal...</p>',
                    type: 'document',
                    category: 'Business',
                    tags: ['business', 'proposal'],
                    isPublic: false,
                    isTemplate: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: 1,
                    author: {
                        id: user?.id || '1',
                        name: user?.name || 'John Doe',
                        email: user?.email || 'john@example.com'
                    },
                    collaborators: [],
                    wordCount: 1500,
                    readingTime: 8
                }
            ];
            setDocuments(mockDocuments);
        } catch (error) {
            console.error('Error loading documents:', error);
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    const createNewDocument = (template?: DocumentTemplate) => {
        const newDoc: Document = {
            id: Date.now().toString(),
            title: template ? template.name : 'New Document',
            content: template ? template.content : '<h1>New Document</h1><p>Start writing your content here...</p>',
            type: 'document',
            category: template ? template.category : 'General',
            tags: template ? template.tags : [],
            isPublic: false,
            isTemplate: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            author: {
                id: user?.id || '1',
                name: user?.name || 'John Doe',
                email: user?.email || 'john@example.com'
            },
            collaborators: [],
            wordCount: 0,
            readingTime: 0
        };
        setSelectedDocument(newDoc);
        setEditorContent(newDoc.content);
        setIsEditing(true);
        setShowTemplates(false);
    };

    const saveDocument = async () => {
        if (!selectedDocument) return;

        try {
            const updatedDoc = {
                ...selectedDocument,
                content: editorContent,
                updatedAt: new Date().toISOString(),
                version: selectedDocument.version + 1
            };

            // Update in local state (in real app, this would be an API call)
            setSelectedDocument(updatedDoc);
            setDocuments(prev => prev.map(doc =>
                doc.id === updatedDoc.id ? updatedDoc : doc
            ));

            toast.success('Document saved successfully');
        } catch (error) {
            console.error('Error saving document:', error);
            toast.error('Failed to save document');
        }
    };

    const exportDocument = (format: 'pdf' | 'docx' | 'txt') => {
        if (!selectedDocument) return;

        try {
            if (format === 'pdf') {
                // Create a simple PDF export
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(`
                        <html>
                            <head>
                                <title>${selectedDocument.title}</title>
                                <style>
                                    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                                    h1, h2, h3 { color: #333; }
                                    ul, ol { margin-left: 20px; }
                                </style>
                            </head>
                            <body>
                                ${editorContent}
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                }
            } else if (format === 'txt') {
                const textContent = editorContent.replace(/<[^>]*>/g, '');
                const blob = new Blob([textContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selectedDocument.title}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }

            toast.success(`Document exported as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Error exporting document:', error);
            toast.error('Failed to export document');
        }
    };

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            setEditorContent(editorRef.current.innerHTML);
        }
    };

    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = searchTerm === '' ||
            doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;

        return matchesSearch && matchesCategory;
    });

    const filteredTemplates = DOCUMENT_TEMPLATES.filter(template => {
        const matchesSearch = searchTerm === '' ||
            template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory = filterCategory === 'all' || template.category === filterCategory;

        return matchesSearch && matchesCategory;
    });

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-12 bg-gray-700 rounded"></div>
                    <div className="h-32 bg-gray-700 rounded"></div>
                    <div className="h-64 bg-gray-700 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FileText className="w-8 h-8 text-teal-400" />
                        Document Hub
                    </h1>
                    <p className="text-slate-400 mt-1">Create, edit, and manage your documents</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowTemplates(true)} className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        New Document
                    </Button>
                    <Button variant="outline" onClick={() => createNewDocument()}>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Blank Document
                    </Button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-full"
                    />
                </div>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                    <option value="all">All Categories</option>
                    <option value="Business">Business</option>
                    <option value="Project Management">Project Management</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Legal">Legal</option>
                    <option value="General">General</option>
                </select>
            </div>

            {/* Document Editor */}
            {selectedDocument && isEditing && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">{selectedDocument.title}</h2>
                            <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                <span>{wordCount} words</span>
                                <span>{readingTime} min read</span>
                                <span>Version {selectedDocument.version}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                                <Eye className="w-4 h-4 mr-2" />
                                {showPreview ? 'Edit' : 'Preview'}
                            </Button>
                            <Button variant="outline" onClick={() => exportDocument('pdf')}>
                                <Download className="w-4 h-4 mr-2" />
                                Export PDF
                            </Button>
                            <Button variant="outline" onClick={() => exportDocument('txt')}>
                                <Download className="w-4 h-4 mr-2" />
                                Export TXT
                            </Button>
                            <Button onClick={saveDocument}>
                                <Save className="w-4 h-4 mr-2" />
                                Save
                            </Button>
                            <Button variant="outline" onClick={() => setIsEditing(false)}>
                                Close
                            </Button>
                        </div>
                    </div>

                    {/* Editor Toolbar */}
                    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex gap-1">
                            <button
                                onClick={() => execCommand('bold')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Bold"
                            >
                                <Bold className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => execCommand('italic')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Italic"
                            >
                                <Italic className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => execCommand('underline')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Underline"
                            >
                                <Underline className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="w-px bg-slate-600 mx-1"></div>

                        <div className="flex gap-1">
                            <button
                                onClick={() => execCommand('justifyLeft')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Align Left"
                            >
                                <AlignLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => execCommand('justifyCenter')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Align Center"
                            >
                                <AlignCenter className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => execCommand('justifyRight')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Align Right"
                            >
                                <AlignRight className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="w-px bg-slate-600 mx-1"></div>

                        <div className="flex gap-1">
                            <button
                                onClick={() => execCommand('insertUnorderedList')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Bullet List"
                            >
                                <List className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => execCommand('insertOrderedList')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Numbered List"
                            >
                                <ListOrdered className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="w-px bg-slate-600 mx-1"></div>

                        <div className="flex gap-1">
                            <button
                                onClick={() => execCommand('formatBlock', 'h1')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Heading 1"
                            >
                                <Heading className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => execCommand('formatBlock', 'h2')}
                                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                                title="Heading 2"
                            >
                                <Type className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Editor Content */}
                    <div className="border border-slate-700 rounded-lg overflow-hidden">
                        {showPreview ? (
                            <div
                                className="p-6 bg-white text-black min-h-96 prose max-w-none"
                                dangerouslySetInnerHTML={{ __html: editorContent }}
                            />
                        ) : (
                            <div
                                ref={editorRef}
                                contentEditable
                                className="p-6 bg-white text-black min-h-96 focus:outline-none"
                                onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                                dangerouslySetInnerHTML={{ __html: editorContent }}
                                suppressContentEditableWarning={true}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Templates Modal */}
            {showTemplates && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white">Choose a Template</h3>
                            <button
                                onClick={() => setShowTemplates(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTemplates.map((template) => (
                                <div
                                    key={template.id}
                                    className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-teal-500 transition-colors cursor-pointer"
                                    onClick={() => createNewDocument(template)}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="text-3xl">{template.thumbnail}</div>
                                        <div className="flex-1">
                                            <h4 className="text-white font-semibold">{template.name}</h4>
                                            <p className="text-slate-400 text-sm mt-1">{template.description}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                                                    {template.category}
                                                </span>
                                                {template.isPremium && (
                                                    <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded flex items-center gap-1">
                                                        <Star className="w-3 h-3" />
                                                        Premium
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1 mt-2">
                                                {template.tags.slice(0, 3).map((tag) => (
                                                    <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Documents List */}
            {!selectedDocument && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-800">
                        <h3 className="text-lg font-bold text-white">Your Documents</h3>
                        <p className="text-slate-400 text-sm mt-1">{filteredDocuments.length} documents found</p>
                    </div>

                    <div className="divide-y divide-slate-800">
                        {filteredDocuments.map((document) => (
                            <div
                                key={document.id}
                                className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer"
                                onClick={() => {
                                    setSelectedDocument(document);
                                    setEditorContent(document.content);
                                    setIsEditing(true);
                                }}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <FileText className="w-6 h-6 text-teal-400 mt-1" />
                                        <div>
                                            <h4 className="text-white font-semibold">{document.title}</h4>
                                            <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Folder className="w-3 h-3" />
                                                    {document.category}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(document.updatedAt).toLocaleDateString()}
                                                </span>
                                                <span>{document.wordCount} words</span>
                                                <span>{document.readingTime} min read</span>
                                            </div>
                                            <div className="flex gap-1 mt-2">
                                                {document.tags.slice(0, 3).map((tag) => (
                                                    <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Handle share
                                            }}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Handle duplicate
                                            }}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredDocuments.length === 0 && (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                            <h3 className="text-white text-lg mb-2">No documents found</h3>
                            <p className="text-slate-400">
                                {searchTerm ? 'Try adjusting your search terms' : 'Create your first document to get started'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}