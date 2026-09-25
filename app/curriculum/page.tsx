'use client';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  GraduationCap,
  Languages,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SidebarNav } from '@/components/SidebarNav';
import {
  backofficeApi,
  type CurriculumResourceItem,
  type CurriculumResourceRequest,
  type CurriculumResourceType,
} from '@/lib/atlas-api';

const STANDARD_SUBJECTS = [
  { code: 'SCIENCE', name: 'Science (විද්‍යාව / அறிவியல்)' },
  { code: 'MATHEMATICS', name: 'Mathematics (ගණිතය / கணிதம்)' },
  { code: 'ICT', name: 'Information & Comm. Technology (තොරතුරු තාක්ෂණය)' },
  { code: 'HISTORY', name: 'History (ඉතිහාසය / வரலாறு)' },
  { code: 'ENGLISH', name: 'English Language (ඉංග්‍රීසි භාෂාව)' },
  { code: 'GEOGRAPHY', name: 'Geography (භූගෝල විද්‍යාව)' },
  { code: 'COMMERCE', name: 'Commerce & Accounting (ව්‍යාපාර හා ගිණුම්කරණය)' },
];

const RESOURCE_TYPES: { value: CurriculumResourceType; label: string }[] = [
  { value: 'TEXTBOOK', label: 'Official Textbook (පෙළපොත)' },
  { value: 'TEACHER_GUIDE', label: 'Teacher Guide (ගුරු මාර්ගෝපදේශය)' },
  { value: 'SYLLABUS', label: 'Syllabus / Curriculum Guide (විෂය නිර්දේශය)' },
  { value: 'PAST_PAPER', label: 'Past Paper / Marking Scheme (පසුගිය විභාග ප්‍රශ්න පත්‍ර)' },
  { value: 'LESSON_MATERIAL', label: 'Lesson / Supplementary Material (අතිරේක කියවීම්)' },
];

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function analyzeFilename(name: string) {
  const lower = name.toLowerCase();

  // Grade heuristic: e.g. gr_10, gr-10, grade 10, g-10, gr10, etc.
  const gradeMatch = lower.match(/(?:grade|gr|\bg)[\s_.-]?(\d{1,2})\b/i);
  let grade = 10;
  if (gradeMatch) {
    const parsed = parseInt(gradeMatch[1], 10);
    if (parsed >= 1 && parsed <= 13) grade = parsed;
  }

  // Subject heuristic
  let subjectCode = 'SCIENCE';
  if (lower.includes('history') || lower.includes('ithihasaya') || lower.includes('varalaaru')) subjectCode = 'HISTORY';
  else if (lower.includes('math') || lower.includes('ganithaya') || lower.includes('kanitham')) subjectCode = 'MATHEMATICS';
  else if (lower.includes('ict') || lower.includes('computer') || lower.includes('information')) subjectCode = 'ICT';
  else if (lower.includes('english') || lower.includes('ingrisi')) subjectCode = 'ENGLISH';
  else if (lower.includes('geo') || lower.includes('bhugola')) subjectCode = 'GEOGRAPHY';
  else if (lower.includes('business') || lower.includes('accounting') || lower.includes('commerce') || lower.includes('vyapara')) subjectCode = 'COMMERCE';
  else if (lower.includes('science') || lower.includes('vidyava') || lower.includes('ariviyal')) subjectCode = 'SCIENCE';

  // Part / Volume heuristic: e.g. part 1, part 2, part i, part ii, p1, p2, p i, p ii
  let part: string | null = null;
  const partMatch = lower.match(/(?:part|pt|\bp)[\s_.-]?([0-9ivx]+)\b/i);
  if (partMatch) {
    part = partMatch[1].toUpperCase();
  }

  // Language / medium heuristic
  let language = 'EN';
  if (lower.includes('_si') || lower.includes('-si') || lower.includes('sinhala') || lower.includes('sin')) language = 'SI';
  else if (lower.includes('_ta') || lower.includes('-ta') || lower.includes('tamil') || lower.includes('tam')) language = 'TA';

  // Clean title: remove file extension and dashes/underscores
  const cleanTitle = name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { grade, subjectCode, language, title: cleanTitle, part };
}

function computeReference(subjectCode: string, grade: number, title: string, part?: string | null): string {
  const subjectSlug = subjectCode.toLowerCase();
  const titleSlug = toSlug(title);
  const partSuffix = part ? `-part-${part.toLowerCase()}` : '';

  if (titleSlug && !titleSlug.startsWith(`moe-lk-${subjectSlug}`)) {
    return `moe-lk-${subjectSlug}-gr${grade}-${titleSlug}`;
  }
  return `moe-lk-${subjectSlug}-gr${grade}${partSuffix}`;
}

function computeVersion(year: number, language: string, part?: string | null): string {
  const lang = language.toLowerCase();
  const partSuffix = part ? `-p${part.toLowerCase()}` : '';
  return `${year}-${lang}${partSuffix}-v1`;
}

export default function CurriculumPage() {
  const [resources, setResources] = useState<CurriculumResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [tenantId, setTenantId] = useState('atlas-pilot');

  // Upload Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadGrade, setUploadGrade] = useState<number>(10);
  const [uploadSubject, setUploadSubject] = useState<string>('SCIENCE');
  const [uploadLanguage, setUploadLanguage] = useState<string>('EN');
  const [uploadResourceType, setUploadResourceType] = useState<CurriculumResourceType>('TEXTBOOK');
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadPublisher, setUploadPublisher] = useState<string>('Educational Publications Department Sri Lanka');
  const [uploadYear, setUploadYear] = useState<number>(2024);
  const [uploadReference, setUploadReference] = useState<string>('');
  const [uploadVersion, setUploadVersion] = useState<string>('2024-en-v1');
  const [isCustomReference, setIsCustomReference] = useState<boolean>(false);
  const [isCustomVersion, setIsCustomVersion] = useState<boolean>(false);
  const [detectedPart, setDetectedPart] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion state
  const [resourceToDelete, setResourceToDelete] = useState<CurriculumResourceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadResources = async () => {
    setIsLoading(true);
    try {
      const data = await backofficeApi.listCurriculumResources(tenantId);
      setResources(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load curriculum resources.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadResources();
  }, [tenantId]);

  const handleConfirmDelete = async () => {
    if (!resourceToDelete) return;
    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await backofficeApi.deleteCurriculumResource(resourceToDelete.revisionId, tenantId);
      setSuccessMessage(
        `Successfully deleted "${resourceToDelete.originalTitle}" and purged ${resourceToDelete.indexedChunks || 0} vector chunks from the AI Tutor vector store.`
      );
      setResourceToDelete(null);
      await loadResources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete curriculum resource.';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const analysis = analyzeFilename(file.name);
    setUploadGrade(analysis.grade);
    setUploadSubject(analysis.subjectCode);
    setUploadLanguage(analysis.language);
    setUploadTitle(analysis.title);
    setDetectedPart(analysis.part);
    setIsCustomReference(false);
    setIsCustomVersion(false);

    const ref = computeReference(analysis.subjectCode, analysis.grade, analysis.title, analysis.part);
    const ver = computeVersion(uploadYear, analysis.language, analysis.part);
    setUploadReference(ref);
    setUploadVersion(ver);
  };

  const handleSubjectChange = (newSubject: string) => {
    setUploadSubject(newSubject);
    if (!isCustomReference) {
      setUploadReference(computeReference(newSubject, uploadGrade, uploadTitle, detectedPart));
    }
  };

  const handleGradeChange = (newGrade: number) => {
    setUploadGrade(newGrade);
    if (!isCustomReference) {
      setUploadReference(computeReference(uploadSubject, newGrade, uploadTitle, detectedPart));
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setUploadLanguage(newLang);
    if (!isCustomVersion) {
      setUploadVersion(computeVersion(uploadYear, newLang, detectedPart));
    }
  };

  const handleYearChange = (newYear: number) => {
    setUploadYear(newYear);
    if (!isCustomVersion) {
      setUploadVersion(computeVersion(newYear, uploadLanguage, detectedPart));
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setUploadTitle(newTitle);
    if (!isCustomReference) {
      setUploadReference(computeReference(uploadSubject, uploadGrade, newTitle, detectedPart));
    }
  };

  const handleUploadSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a curriculum file (.pdf, .docx, .txt) to upload.');
      return;
    }
    if (!uploadTitle.trim()) {
      setError('Original Title is required.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    const metadata: CurriculumResourceRequest = {
      scope: {
        knowledgeSpaceCode: 'NATIONAL',
        countryCode: 'LK',
        curriculumCode: 'NATIONAL',
        curriculumVersion: 'POC-UNVERIFIED',
        grade: Number(uploadGrade),
        subjectCode: uploadSubject,
        language: uploadLanguage,
      },
      resourceType: uploadResourceType,
      originalTitle: uploadTitle.trim(),
      publisherAuthority: uploadPublisher.trim() || 'Educational Publications Department Sri Lanka',
      sourceReference: uploadReference.trim() || `ref-${toSlug(uploadTitle) || selectedFile.name}`,
      publicationYear: Number(uploadYear),
      rightsStatus: 'POC_EVALUATION_ONLY',
      versionIdentifier: uploadVersion.trim() || `${uploadYear}-${uploadLanguage.toLowerCase()}-v1`,
    };

    try {
      const res = await backofficeApi.uploadCurriculumResource(selectedFile, metadata, tenantId);
      setSuccessMessage(
        `Successfully indexed "${uploadTitle}"! Created resource ${res.resourceId.substring(0, 8)} with ${res.indexedChunks} searchable chunks in the Learn Vector Store.`
      );
      setSelectedFile(null);
      setUploadTitle('');
      setUploadReference('');
      setUploadVersion('2024-en-v1');
      setIsCustomReference(false);
      setIsCustomVersion(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadResources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Curriculum upload failed.';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Filtered resources
  const filteredResources = resources.filter((res) => {
    const matchesQuery =
      !searchQuery ||
      res.originalTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.subjectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.subjectCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.sourceReference?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGrade = gradeFilter === 'ALL' || res.grade === Number(gradeFilter);
    const matchesSubject = subjectFilter === 'ALL' || res.subjectCode === subjectFilter;

    return matchesQuery && matchesGrade && matchesSubject;
  });

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalChunks = resources.reduce((sum, r) => sum + (r.indexedChunks || 0), 0);
  const uniqueLanguages = new Set(resources.map((r) => r.languageCode)).size;

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
          <SidebarNav active="/curriculum" />

          <section className="min-w-0 flex flex-col">
            <header className="flex h-16 items-center justify-between border-b bg-card/80 px-5 backdrop-blur md:px-8">
              <div className="flex items-center gap-3 min-w-0">
                <GraduationCap className="size-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Curriculum Knowledge Base</p>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    Ingest &amp; ground official Sri Lankan syllabus books into the ATLAS Learn AI Tutor
                  </p>
                </div>
              </div>
            </header>
            <div className="flex flex-1 items-center justify-center p-12">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span>Loading curriculum catalog...</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <SidebarNav active="/curriculum" />

        <section className="min-w-0 flex flex-col">
          {/* Header */}
          <header className="flex h-16 items-center justify-between border-b bg-card/80 px-5 backdrop-blur md:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <GraduationCap className="size-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Curriculum Knowledge Base</p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Ingest & ground official Sri Lankan syllabus books into the ATLAS Learn AI Tutor
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Tenant:</span>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="atlas-pilot">atlas-pilot</option>
                  <option value="learn-consumer">learn-consumer</option>
                </select>
              </div>
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="size-4" />
              </Button>
              <div className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                NP
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] w-full space-y-7 p-5 md:p-8 flex-1">
            {/* Top Info Banner */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="mb-1 text-sm font-medium text-primary">Sri Lanka National Syllabus Ingestion</p>
                <h1 className="text-3xl font-semibold tracking-tight">Curriculum & Textbooks</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload official syllabus PDFs. Chunks are automatically enriched with grade, medium, and subject ontology for the AI Tutor.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadResources}
                disabled={isLoading}
                className="gap-2 self-start"
              >
                <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Catalog
              </Button>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Materials</CardTitle>
                  <BookOpen className="size-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{resources.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Official textbooks & guides</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Indexed Vector Chunks</CardTitle>
                  <Database className="size-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalChunks.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active in pgvector store</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Languages / Mediums</CardTitle>
                  <Languages className="size-4 text-cyan-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{uniqueLanguages || 1} Mediums</div>
                  <p className="text-xs text-muted-foreground mt-1">English, Sinhala & Tamil</p>
                </CardContent>
              </Card>
            </div>

            {/* Status alerts */}
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive flex items-center gap-3 text-sm">
                <XCircle className="size-5 flex-shrink-0" />
                <p className="flex-1">{error}</p>
                <button type="button" onClick={() => setError(null)} className="text-xs underline font-medium">
                  Dismiss
                </button>
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300 flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="flex-1">{successMessage}</p>
                <button type="button" onClick={() => setSuccessMessage(null)} className="text-xs underline font-medium">
                  Dismiss
                </button>
              </div>
            )}

            {/* 1. Upload Form Card */}
            <Card className="border-primary/20 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UploadCloud className="size-5 text-primary" />
                  <span>Upload Curriculum Resource</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Select an official Sri Lankan textbook or syllabus file (.pdf, .docx, .txt). The system will automatically chunk, quality-audit, and index the material.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUploadSubmit} className="space-y-6">
                  {/* File Upload Zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      selectedFile
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                      }}
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-3 text-foreground">
                        <FileText className="size-8 text-primary" />
                        <div className="text-left">
                          <p className="text-sm font-semibold">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drop another to replace
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-muted-foreground">
                        <Upload className="mx-auto size-8 text-muted-foreground/60" />
                        <p className="text-sm font-medium text-foreground">
                          Click to select a curriculum file, or drag and drop here
                        </p>
                        <p className="text-xs">Supports PDF, DOCX, TXT (Maximum 100 MB)</p>
                      </div>
                    )}
                  </div>

                  {/* Metadata Form Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Grade Selector */}
                    <div className="space-y-1.5">
                      <label htmlFor="curriculum-grade" className="text-xs font-semibold text-foreground">Grade (ශ්‍රේණිය / தரம்)</label>
                      <select
                        id="curriculum-grade"
                        value={uploadGrade}
                        onChange={(e) => handleGradeChange(Number(e.target.value))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {Array.from({ length: 13 }, (_, i) => i + 1).map((g) => (
                          <option key={g} value={g}>
                            Grade {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subject Selector */}
                    <div className="space-y-1.5">
                      <label htmlFor="curriculum-subject" className="text-xs font-semibold text-foreground">Subject (විෂය / பாடம்)</label>
                      <select
                        id="curriculum-subject"
                        value={uploadSubject}
                        onChange={(e) => handleSubjectChange(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {STANDARD_SUBJECTS.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Language / Medium */}
                    <div className="space-y-1.5">
                      <label htmlFor="curriculum-medium" className="text-xs font-semibold text-foreground">Medium / Language (මාධ්‍යය)</label>
                      <select
                        id="curriculum-medium"
                        value={uploadLanguage}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="EN">English Medium (EN)</option>
                        <option value="SI">Sinhala Medium (සිංහල - SI)</option>
                        <option value="TA">Tamil Medium (தமிழ் - TA)</option>
                      </select>
                    </div>

                    {/* Resource Type */}
                    <div className="space-y-1.5">
                      <label htmlFor="curriculum-type" className="text-xs font-semibold text-foreground">Resource Type</label>
                      <select
                        id="curriculum-type"
                        value={uploadResourceType}
                        onChange={(e) => setUploadResourceType(e.target.value as CurriculumResourceType)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {RESOURCE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Book / Resource Title */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="curriculum-title" className="text-xs font-semibold text-foreground">Original Book / Document Title</label>
                      <Input
                        id="curriculum-title"
                        value={uploadTitle}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="e.g. Science Grade 10 Part I"
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    {/* Publisher / Authority */}
                    <div className="space-y-1.5">
                      <label htmlFor="curriculum-publisher" className="text-xs font-semibold text-foreground">Publisher / Authority</label>
                      <Input
                        id="curriculum-publisher"
                        value={uploadPublisher}
                        onChange={(e) => setUploadPublisher(e.target.value)}
                        placeholder="e.g. Educational Publications Dept"
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Publication Year */}
                    <div className="space-y-1.5">
                      <label htmlFor="curriculum-year" className="text-xs font-semibold text-foreground">Publication Year</label>
                      <Input
                        id="curriculum-year"
                        type="number"
                        value={uploadYear}
                        onChange={(e) => handleYearChange(Number(e.target.value))}
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Source Reference */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="curriculum-ref" className="text-xs font-semibold text-foreground">Source Reference / Catalog ID</label>
                      <Input
                        id="curriculum-ref"
                        value={uploadReference}
                        onChange={(e) => {
                          setUploadReference(e.target.value);
                          setIsCustomReference(true);
                        }}
                        placeholder="e.g. moe-lk-history-gr10-history-grade-10"
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    {/* Version Identifier */}
                    <div className="space-y-1.5 sm:col-span-1">
                      <label htmlFor="curriculum-ver" className="text-xs font-semibold text-foreground">Version Identifier</label>
                      <Input
                        id="curriculum-ver"
                        value={uploadVersion}
                        onChange={(e) => {
                          setUploadVersion(e.target.value);
                          setIsCustomVersion(true);
                        }}
                        placeholder="e.g. 2024-en-v1"
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    {/* Target Knowledge Space */}
                    <div className="space-y-1.5 sm:col-span-1">
                      <label htmlFor="curriculum-std" className="text-xs font-semibold text-foreground">Curriculum Standard</label>
                      <Input
                        id="curriculum-std"
                        value="Sri Lanka National (LK-NATIONAL)"
                        disabled
                        className="h-9 text-xs bg-muted text-muted-foreground"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadTitle('');
                        setUploadReference('');
                        setUploadVersion('2024-en-v1');
                        setIsCustomReference(false);
                        setIsCustomVersion(false);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      disabled={isUploading}
                    >
                      Clear
                    </Button>
                    <Button type="submit" size="sm" disabled={!selectedFile || isUploading} className="gap-2">
                      {isUploading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Chunking & Indexing...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          <span>Upload & Index Resource</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* 2. Existing Resources Catalog Table */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layers className="size-5 text-primary" />
                    <span>Indexed Curriculum Catalog</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Official syllabus materials currently eligible for AI Tutor semantic search & citation grounding.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title, subject..."
                      className="h-8 pl-8 text-xs w-44 sm:w-56"
                    />
                  </div>

                  {/* Grade filter */}
                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ALL">All Grades</option>
                    {Array.from({ length: 13 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>

                  {/* Subject filter */}
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ALL">All Subjects</option>
                    {STANDARD_SUBJECTS.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code}
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center p-12 text-muted-foreground gap-2 text-sm">
                    <Loader2 className="size-5 animate-spin text-primary" />
                    <span>Loading curriculum resources...</span>
                  </div>
                ) : filteredResources.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground space-y-2">
                    <BookOpen className="size-10 mx-auto text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">No curriculum materials found</p>
                    <p className="text-xs">
                      {resources.length === 0
                        ? 'No curriculum resources have been uploaded for this tenant yet. Use the form above to index your first textbook.'
                        : 'No materials match the active search or filter criteria.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                        <tr>
                          <th className="px-4 py-3">Resource Title & Source</th>
                          <th className="px-4 py-3">Scope (Grade / Subject)</th>
                          <th className="px-4 py-3">Medium</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Vector Chunks</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Ingested Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredResources.map((res) => {
                          const statusColor =
                            res.ingestionStatus === 'INDEXED'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : res.ingestionStatus === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                              : 'bg-destructive/10 text-destructive border-destructive/30';

                          return (
                            <tr key={res.revisionId} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3.5 min-w-[220px]">
                                <div className="font-semibold text-foreground text-sm">{res.originalTitle}</div>
                                <div className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                                  {res.publisherAuthority} • {res.publicationYear || 'N/A'}
                                </div>
                                <div className="text-[10px] text-primary/80 font-mono mt-0.5 truncate max-w-xs">
                                  Ref: {res.sourceReference}
                                </div>
                              </td>

                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="font-bold text-[10px]">
                                    Grade {res.grade}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {res.subjectName || res.subjectCode}
                                  </Badge>
                                </div>
                              </td>

                              <td className="px-4 py-3.5">
                                <Badge
                                  className={`text-[10px] font-bold ${
                                    res.languageCode === 'SI'
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                      : res.languageCode === 'TA'
                                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                  }`}
                                >
                                  {res.languageCode === 'SI'
                                    ? 'Sinhala'
                                    : res.languageCode === 'TA'
                                    ? 'Tamil'
                                    : 'English'}
                                </Badge>
                              </td>

                              <td className="px-4 py-3.5 font-medium text-muted-foreground">
                                {res.resourceType}
                              </td>

                              <td className="px-4 py-3.5">
                                <span className="font-semibold text-foreground">
                                  {res.indexedChunks || 0}
                                </span>{' '}
                                <span className="text-[10px] text-muted-foreground">chunks</span>
                              </td>

                              <td className="px-4 py-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}
                                >
                                  {res.ingestionStatus}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                                {res.ingestedAt ? new Date(res.ingestedAt).toLocaleDateString() : '—'}
                              </td>

                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  onClick={() => setResourceToDelete(res)}
                                  title="Delete curriculum resource"
                                  aria-label={`Delete ${res.originalTitle}`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {resourceToDelete && (
        <dialog
          open
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 border-0 w-full h-full max-w-none max-h-none m-0 animate-in fade-in-0"
        >
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-foreground animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/15 text-destructive flex-shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="font-semibold text-base text-foreground">
                  Delete Curriculum Resource
                </h3>
                <p className="text-xs text-muted-foreground">Permanent deletion from all systems</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1.5 border border-border/80">
              <div>
                <span className="text-muted-foreground">Title: </span>
                <span className="font-semibold text-foreground">{resourceToDelete.originalTitle}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Scope: </span>
                <span className="font-medium text-foreground">
                  Grade {resourceToDelete.grade} • {resourceToDelete.subjectName || resourceToDelete.subjectCode}
                </span>
              </div>
              <div className="truncate">
                <span className="text-muted-foreground">Catalog Ref: </span>
                <span className="font-mono text-foreground">{resourceToDelete.sourceReference}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Searchable Chunks: </span>
                <span className="font-semibold text-destructive">
                  {resourceToDelete.indexedChunks || 0} chunks in pgvector store
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This action cannot be undone. The original document binary will be removed from storage, cached page previews will be cleared, and all <strong>{resourceToDelete.indexedChunks || 0} vector chunks</strong> will be purged so the AI Tutor can no longer reference or cite this material.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResourceToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    <span>Delete Resource</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  );
}
