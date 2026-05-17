'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { validateImport, transformImport, type QuestionnaireImport, type ImportError } from '@/lib/import';
import { FileJson, X, Check, BookOpen } from 'lucide-react';
import styles from './editor.module.css';

interface ImportModalProps {
  onClose: () => void;
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const store = useQuestionnaireStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [preview, setPreview] = useState<QuestionnaireImport | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);

  const processJson = useCallback((raw: string) => {
    setJsonText(raw);
    setErrors([]);
    setPreview(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setErrors([{ path: '', message: `Invalid JSON: ${(e as Error).message}` }]);
      return;
    }

    const validationErrors = validateImport(parsed);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setPreview(parsed as QuestionnaireImport);
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      file.text().then(processJson);
    } else if (file) {
      file.text().then(processJson); // try anyway for .txt etc
    }
  }, [processJson]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) file.text().then(processJson);
  }, [processJson]);

  const handleImport = useCallback(() => {
    if (!preview || !store.questionnaire) return;
    setImporting(true);

    const qId = store.questionnaire.id;
    const { questions, branches, scoringRules, scoreResults, design } = transformImport(preview, qId, store.design);

    // Update title if provided
    if (preview.title) {
      store.updateTitle(preview.title);
    }

    // Replace content layers only if they were in the import
    if (questions && questions.length > 0) {
      store.setQuestions(questions);
      if (branches) store.setBranches(branches);
      if (scoringRules) store.setScoringRules(scoringRules);
    }
    if (scoreResults && scoreResults.length > 0) {
      store.setScoreResults(scoreResults);
    }

    // Apply design (deep-merged)
    if (design) {
      store.updateDesign(design);
    }

    setImporting(false);
    onClose();
  }, [preview, store, onClose]);

  const hasQuestions = (preview?.questions?.length ?? 0) > 0;
  const hasDesign = !!preview?.design;
  const branchCount = preview?.questions
    ? preview.questions.reduce((acc, q) => acc + (q.branches?.length || 0), 0)
    : 0;
  const scoredCount = preview?.questions
    ? preview.questions.filter((q) => q.scoring).length
    : 0;
  const designLayerCount = hasDesign
    ? Object.keys(preview!.design!).length
    : 0;

  return (
    <div className={styles.importOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.importModal}>
        {/* Header */}
        <div className={styles.importHeader}>
          <h2 className={styles.importTitle}>Import Questionnaire</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.importBody}>
          {/* Drop zone */}
          <div
            className={`${styles.importDropzone} ${dragOver ? styles.dragOver : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            <div className={styles.importDropzoneIcon}>
              <FileJson size={22} strokeWidth={1.5} />
            </div>
            <div className={styles.importDropzoneText}>
              {dragOver ? 'Drop JSON file here' : 'Click or drag a JSON file'}
            </div>
            <div className={styles.importDropzoneHint}>
              Supports .json files with content, design, logic, and scoring
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* Divider */}
          <div className={styles.importDivider}>
            <span>or paste JSON directly</span>
          </div>

          {/* Text area */}
          <textarea
            className={styles.importTextarea}
            value={jsonText}
            onChange={(e) => processJson(e.target.value)}
            placeholder={`{
  "title": "My Questionnaire",
  "design": {
    "colors": { "primary": "#6C5CE7" },
    "typography": { "heading": { "size": 28 } }
  },
  "questions": [
    {
      "key": "q1",
      "type": "radio",
      "title": "What is your role?",
      "options": [
        { "key": "dev", "label": "Developer" },
        { "key": "designer", "label": "Designer" }
      ]
    }
  ]
}`}
          />

          {/* Errors */}
          {errors.length > 0 && (
            <div className={styles.importErrors}>
              {errors.map((err, i) => (
                <div key={i} className={styles.importErrorItem}>
                  {err.path && <span className={styles.importErrorPath}>{err.path}:</span>}
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {preview && errors.length === 0 && (
            <div className={styles.importPreview}>
              <div className={styles.importPreviewTitle}>
                <Check size={14} strokeWidth={2.25} /> Valid — ready to import
              </div>
              <div className={styles.importPreviewStats}>
                {hasQuestions && (
                  <>
                    <div className={styles.importStat}>
                      <span className={styles.importStatValue}>{preview.questions!.length}</span>
                      <span className={styles.importStatLabel}>Questions</span>
                    </div>
                    <div className={styles.importStat}>
                      <span className={styles.importStatValue}>{branchCount}</span>
                      <span className={styles.importStatLabel}>Branches</span>
                    </div>
                    <div className={styles.importStat}>
                      <span className={styles.importStatValue}>{scoredCount}</span>
                      <span className={styles.importStatLabel}>Scored</span>
                    </div>
                  </>
                )}
                {(preview.score_results?.length ?? 0) > 0 && (
                  <div className={styles.importStat}>
                    <span className={styles.importStatValue}>{preview.score_results!.length}</span>
                    <span className={styles.importStatLabel}>Result Ranges</span>
                  </div>
                )}
                {hasDesign && (
                  <div className={styles.importStat}>
                    <span className={styles.importStatValue}>{designLayerCount}</span>
                    <span className={styles.importStatLabel}>Design {designLayerCount === 1 ? 'Layer' : 'Layers'}</span>
                  </div>
                )}
              </div>
              {/* Show what layers will be affected */}
              <div style={{ marginTop: '0.625rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {preview.title && <span className="badge badge-accent">Title</span>}
                {hasQuestions && <span className="badge badge-accent">Content</span>}
                {hasDesign && <span className="badge badge-accent">Design</span>}
                {(preview.score_results?.length ?? 0) > 0 && <span className="badge badge-accent">Results</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.importFooter}>
          <a href="/docs" target="_blank" className={styles.importFooterLink}>
            <BookOpen size={13} strokeWidth={1.75} /> JSON Schema Docs
          </a>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!preview || errors.length > 0 || importing}
            >
              {importing ? 'Importing...' : hasQuestions && hasDesign ? 'Import All' : hasDesign ? 'Apply Design' : 'Import & Replace'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
