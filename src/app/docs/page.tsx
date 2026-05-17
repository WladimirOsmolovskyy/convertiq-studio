'use client';

import { useState } from 'react';
import styles from './docs.module.css';

const FULL_EXAMPLE = `{
  "title": "Developer Experience Survey",
  "questions": [
    {
      "key": "role",
      "type": "radio",
      "title": "What is your primary role?",
      "description": "Select the option that best describes your day-to-day work.",
      "options": [
        { "key": "frontend", "label": "Frontend Developer" },
        { "key": "backend", "label": "Backend Developer" },
        { "key": "fullstack", "label": "Full-Stack Developer" },
        { "key": "devops", "label": "DevOps / SRE" },
        { "key": "other", "label": "Other" }
      ],
      "branches": [
        { "if_option": "other", "goto": "role_other" }
      ],
      "scoring": {
        "type": "fixed",
        "option_scores": {
          "frontend": 2,
          "backend": 3,
          "fullstack": 5,
          "devops": 4,
          "other": 1
        }
      }
    },
    {
      "key": "role_other",
      "type": "text",
      "title": "Please describe your role",
      "required": false,
      "scoring": {
        "type": "fixed",
        "any_answer_score": 1
      }
    },
    {
      "key": "experience",
      "type": "dropdown",
      "title": "Years of experience?",
      "options": [
        { "key": "junior", "label": "0-2 years" },
        { "key": "mid", "label": "3-5 years" },
        { "key": "senior", "label": "6-10 years" },
        { "key": "staff", "label": "10+ years" }
      ],
      "scoring": {
        "type": "fixed",
        "option_scores": {
          "junior": 1,
          "mid": 3,
          "senior": 5,
          "staff": 7
        }
      }
    },
    {
      "key": "satisfaction",
      "type": "rating",
      "title": "How satisfied are you with your current tooling?"
    },
    {
      "key": "tools",
      "type": "checkbox",
      "title": "Which tools do you use daily?",
      "options": [
        { "key": "vscode", "label": "VS Code" },
        { "key": "jetbrains", "label": "JetBrains IDE" },
        { "key": "vim", "label": "Vim / Neovim" },
        { "key": "terminal", "label": "Terminal / CLI" },
        { "key": "figma", "label": "Figma" }
      ],
      "scoring": {
        "type": "fixed",
        "option_scores": {
          "vscode": 1,
          "jetbrains": 2,
          "vim": 3,
          "terminal": 2,
          "figma": 1
        }
      }
    },
    {
      "key": "improvement",
      "type": "textarea",
      "title": "What would you improve about your development workflow?",
      "scoring": {
        "type": "ai",
        "ai_min": 0,
        "ai_max": 10,
        "ai_prompt": "Score higher if the answer is specific, mentions concrete tools or processes, and demonstrates deep understanding of development workflows. Score lower for vague or generic responses."
      }
    },
    {
      "key": "email",
      "type": "email",
      "title": "Your email (optional)",
      "required": false
    }
  ],
  "score_results": [
    {
      "min_score": 0,
      "max_score": 10,
      "title": "Getting Started",
      "description": "You're early in your development journey. Check out our beginner resources!"
    },
    {
      "min_score": 11,
      "max_score": 20,
      "title": "Growing Developer",
      "description": "You have solid experience. Our intermediate guides will help you level up."
    },
    {
      "min_score": 21,
      "max_score": 100,
      "title": "Expert Developer",
      "description": "You're highly experienced! Consider our advanced platform features."
    }
  ]
}`;

const MINIMAL_EXAMPLE = `{
  "questions": [
    {
      "key": "q1",
      "type": "radio",
      "title": "Do you like pizza?",
      "options": [
        { "key": "yes", "label": "Yes" },
        { "key": "no", "label": "No" }
      ]
    }
  ]
}`;

const DESIGN_ONLY_EXAMPLE = `{
  "design": {
    "colors": {
      "primary": "#6C5CE7",
      "background": "#1a1a2e",
      "surface": "#222244",
      "text": "#ffffff",
      "textMuted": "#a0a0c0"
    },
    "typography": {
      "fontFamily": "'Playfair Display', serif",
      "headingFont": "'Playfair Display', serif",
      "heading": { "size": 28, "weight": 700 },
      "body": { "size": 15, "weight": 400 }
    },
    "layout": {
      "borderRadius": 16
    }
  }
}`;

const PARTIAL_DESIGN_EXAMPLE = `{
  "design": {
    "colors": {
      "primary": "#E74C3C"
    }
  }
}`;

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.docsCode}>
      <div className={styles.docsCodeHeader}>
        <span>{title}</span>
        <button className={styles.docsCopyBtn} onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className={styles.docsCodeBody}>
        <pre>{code}</pre>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.022em' }}>
          JSON Import
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.375rem', letterSpacing: '-0.008em' }}>
          Reference for the questionnaire import schema.
        </p>
      </div>

      <div className={styles.docsPage}>
          <p className={styles.docsSubtitle}>
            Import questionnaires from JSON to set up content, branching, scoring, and visual design.
            Use human-readable <code>key</code> references instead of UUIDs — the system generates internal IDs automatically.
          </p>

          <div className={`${styles.docsCallout} ${styles.docsCalloutInfo}`}>
            <strong>Flexible imports.</strong> Every top-level field is optional. You can import an entire questionnaire, update just the design, change a single color, or any combination. Content layers (questions, branches, scoring) are replaced; design layers are deep-merged with existing settings.
          </div>

          {/* ─── Root Schema ───────────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Root Object</h2>
            <table className={styles.docsTable}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>title</code> <span className={`${styles.docsBadge} ${styles.docsBadgeOptional}`}>optional</span></td>
                  <td>string</td>
                  <td>Sets the questionnaire title. If omitted, the current title is kept.</td>
                </tr>
                <tr>
                  <td><code>questions</code> <span className={`${styles.docsBadge} ${styles.docsBadgeOptional}`}>optional</span></td>
                  <td>array</td>
                  <td>Array of question objects. Replaces all existing questions when provided.</td>
                </tr>
                <tr>
                  <td><code>design</code> <span className={`${styles.docsBadge} ${styles.docsBadgeOptional}`}>optional</span></td>
                  <td>object</td>
                  <td>Visual customization. Deep-merged with existing settings — include only what you want to change.</td>
                </tr>
                <tr>
                  <td><code>score_results</code> <span className={`${styles.docsBadge} ${styles.docsBadgeOptional}`}>optional</span></td>
                  <td>array</td>
                  <td>Score ranges that determine the result message shown after completion.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── Question Schema ──────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Question Object</h2>
            <p className={styles.docsSectionDesc}>
              Each question needs a unique <code>key</code> for cross-referencing in branches and scoring.
            </p>
            <table className={styles.docsTable}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>key</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>string</td>
                  <td>Unique identifier for this question. Used by branches and scoring to reference it.</td>
                </tr>
                <tr>
                  <td><code>type</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>string</td>
                  <td>
                    One of: <code>radio</code>, <code>checkbox</code>, <code>dropdown</code>, <code>text</code>,
                    <code>textarea</code>, <code>number</code>, <code>email</code>, <code>rating</code>
                  </td>
                </tr>
                <tr>
                  <td><code>title</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>string</td>
                  <td>The question text shown to the end user.</td>
                </tr>
                <tr>
                  <td><code>description</code></td>
                  <td>string</td>
                  <td>Optional helper text displayed below the title.</td>
                </tr>
                <tr>
                  <td><code>required</code></td>
                  <td>boolean</td>
                  <td>Whether an answer is required to proceed. Defaults to <code>true</code>.</td>
                </tr>
                <tr>
                  <td><code>options</code></td>
                  <td>array</td>
                  <td>Required for <code>radio</code>, <code>checkbox</code>, and <code>dropdown</code> types.</td>
                </tr>
                <tr>
                  <td><code>branches</code></td>
                  <td>array</td>
                  <td>Conditional logic rules evaluated after this question is answered.</td>
                </tr>
                <tr>
                  <td><code>scoring</code></td>
                  <td>object</td>
                  <td>Scoring configuration for this question.</td>
                </tr>
                <tr>
                  <td><code>validation</code></td>
                  <td>object</td>
                  <td>Optional: <code>{`{ min, max, pattern, maxLength }`}</code> for input validation.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── Option Schema ────────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Option Object</h2>
            <p className={styles.docsSectionDesc}>
              Used by <code>radio</code>, <code>checkbox</code>, and <code>dropdown</code> question types.
            </p>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>key</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>string</td>
                  <td>Unique key within this question. Referenced by <code>branches.if_option</code> and <code>scoring.option_scores</code>.</td>
                </tr>
                <tr>
                  <td><code>label</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>string</td>
                  <td>Display text shown to the end user.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── Branch Schema ────────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Branch Object</h2>
            <p className={styles.docsSectionDesc}>
              Branches allow conditional navigation. For choice questions, use <code>if_option</code>.
              For open-ended questions, use <code>operator</code> + <code>value</code>.
              Each branch must specify either <code>goto</code> (a question key) or <code>end: true</code>.
            </p>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>if_option</code></td>
                  <td>string</td>
                  <td>Option key that triggers this branch (for radio/checkbox/dropdown).</td>
                </tr>
                <tr>
                  <td><code>operator</code></td>
                  <td>string</td>
                  <td>For open questions: <code>equals</code>, <code>not_equals</code>, <code>contains</code>, <code>greater_than</code>, <code>less_than</code></td>
                </tr>
                <tr>
                  <td><code>value</code></td>
                  <td>string</td>
                  <td>Value to compare against (used with <code>operator</code>).</td>
                </tr>
                <tr>
                  <td><code>goto</code></td>
                  <td>string</td>
                  <td>Question key to jump to when the condition matches.</td>
                </tr>
                <tr>
                  <td><code>end</code></td>
                  <td>boolean</td>
                  <td>If <code>true</code>, the questionnaire ends when this branch matches.</td>
                </tr>
              </tbody>
            </table>

            <div className={`${styles.docsCallout} ${styles.docsCalloutWarning}`}>
              Questions without matching branches proceed to the next question in order. If no branches match, the default sequential flow is used.
            </div>
          </div>

          {/* ─── Scoring Schema ───────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Scoring Object</h2>
            <p className={styles.docsSectionDesc}>
              Two scoring modes: <code>fixed</code> (point values per option) and <code>ai</code> (LLM-evaluated open answers).
            </p>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>type</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>string</td>
                  <td><code>&quot;fixed&quot;</code> or <code>&quot;ai&quot;</code></td>
                </tr>
                <tr>
                  <td><code>option_scores</code></td>
                  <td>object</td>
                  <td>Map of option key → point value. Used when <code>type</code> is <code>&quot;fixed&quot;</code> for choice questions.</td>
                </tr>
                <tr>
                  <td><code>any_answer_score</code></td>
                  <td>number</td>
                  <td>Flat score awarded for any answer on open questions (with <code>type: &quot;fixed&quot;</code>).</td>
                </tr>
                <tr>
                  <td><code>ai_min</code></td>
                  <td>number</td>
                  <td>Minimum score for AI evaluation. Default: <code>0</code></td>
                </tr>
                <tr>
                  <td><code>ai_max</code></td>
                  <td>number</td>
                  <td>Maximum score for AI evaluation. Default: <code>10</code></td>
                </tr>
                <tr>
                  <td><code>ai_prompt</code></td>
                  <td>string</td>
                  <td>Instructions for the AI on how to evaluate and score the answer.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── Score Results ────────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Score Result Object</h2>
            <p className={styles.docsSectionDesc}>
              Define messages shown to end users based on their total score.
            </p>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>min_score</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>number</td>
                  <td>Minimum total score for this result to display.</td>
                </tr>
                <tr>
                  <td><code>max_score</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>number</td>
                  <td>Maximum total score for this result to display.</td>
                </tr>
                <tr>
                  <td><code>title</code> <span className={`${styles.docsBadge} ${styles.docsBadgeRequired}`}>required</span></td>
                  <td>string</td>
                  <td>Heading shown on the results page.</td>
                </tr>
                <tr>
                  <td><code>description</code></td>
                  <td>string</td>
                  <td>Body text explaining the result.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Design Object</h2>
            <p className={styles.docsSectionDesc}>
              Customize the visual appearance. Every field is optional — include only what you want to change.
              Values are deep-merged with the current design, so you can update a single color without affecting anything else.
            </p>

            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text)' }}>colors</h3>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>primary</code></td><td>string</td><td>Main accent color (buttons, progress bar). e.g. <code>{`"#007aff"`}</code></td></tr>
                <tr><td><code>secondary</code></td><td>string</td><td>Secondary accent color.</td></tr>
                <tr><td><code>background</code></td><td>string</td><td>Page background color.</td></tr>
                <tr><td><code>surface</code></td><td>string</td><td>Card/panel surface color.</td></tr>
                <tr><td><code>text</code></td><td>string</td><td>Primary text color.</td></tr>
                <tr><td><code>textMuted</code></td><td>string</td><td>Secondary/muted text color.</td></tr>
                <tr><td><code>accent</code></td><td>string</td><td>Highlight accent (selected states).</td></tr>
              </tbody>
            </table>

            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text)' }}>typography</h3>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>fontFamily</code></td><td>string</td><td>CSS font stack for body text. e.g. <code>{`"'Inter', sans-serif"`}</code></td></tr>
                <tr><td><code>headingFont</code></td><td>string</td><td>CSS font stack for headings.</td></tr>
                <tr><td><code>body</code></td><td>object</td><td><code>{`{ size, weight, lineHeight, letterSpacing, color }`}</code></td></tr>
                <tr><td><code>heading</code></td><td>object</td><td><code>{`{ size, weight, lineHeight, letterSpacing, color }`}</code></td></tr>
              </tbody>
            </table>
            <div className={`${styles.docsCallout} ${styles.docsCalloutInfo}`} style={{ marginTop: '0.75rem' }}>
              <code>body.size</code> and <code>heading.size</code> are in <strong>px</strong>. <code>letterSpacing</code> is in <strong>em</strong>. <code>weight</code> must match a weight available for the chosen font (e.g. Playfair Display supports 400–900).
            </div>

            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text)' }}>layout</h3>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>maxWidth</code></td><td>number</td><td>Maximum content width in px (default: 680).</td></tr>
                <tr><td><code>padding</code></td><td>number</td><td>Horizontal padding in rem.</td></tr>
                <tr><td><code>borderRadius</code></td><td>number</td><td>Corner radius in px.</td></tr>
                <tr><td><code>questionSpacing</code></td><td>number</td><td>Gap between question cards in rem.</td></tr>
              </tbody>
            </table>

            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text)' }}>components</h3>
            <p className={styles.docsSectionDesc}>
              Fine-tune individual UI elements: <code>question</code>, <code>option</code>, <code>button</code>, <code>progress</code>, and <code>input</code>.
              Each accepts CSS string values for borders, backgrounds, shadows, etc.
            </p>

            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text)' }}>background</h3>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>type</code></td><td>string</td><td><code>{`"solid"`}</code>, <code>{`"gradient"`}</code>, or <code>{`"image"`}</code></td></tr>
                <tr><td><code>value</code></td><td>string</td><td>CSS gradient string or image URL (for gradient/image types).</td></tr>
              </tbody>
            </table>
          </div>

          {/* ─── Minimal Example ──────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Minimal Example</h2>
            <p className={styles.docsSectionDesc}>
              The simplest valid import — a single radio question with two options:
            </p>
            <CodeBlock title="minimal.json" code={MINIMAL_EXAMPLE} />
          </div>

          {/* ─── Design Only Example ───────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Design-Only Import</h2>
            <p className={styles.docsSectionDesc}>
              Import just the visual design without touching questions or scoring.
              All design fields are deep-merged — existing settings you don&apos;t include remain unchanged.
            </p>
            <CodeBlock title="dark_theme.json" code={DESIGN_ONLY_EXAMPLE} />
          </div>

          {/* ─── Partial Design Example ─────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Single-Setting Import</h2>
            <p className={styles.docsSectionDesc}>
              You can import as little as a single setting. This example changes only the primary color:
            </p>
            <CodeBlock title="change_primary_color.json" code={PARTIAL_DESIGN_EXAMPLE} />
          </div>

          {/* ─── Full Example ─────────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Full Example</h2>
            <p className={styles.docsSectionDesc}>
              A complete questionnaire with multiple question types, branching logic, fixed & AI scoring, and result ranges:
            </p>
            <CodeBlock title="developer_survey.json" code={FULL_EXAMPLE} />
          </div>

          {/* ─── Supported Types ──────────────────────────── */}
          <div className={styles.docsSection}>
            <h2 className={styles.docsSectionTitle}>Question Types Reference</h2>
            <table className={styles.docsTable}>
              <thead>
                <tr><th>Type</th><th>Options Required</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>radio</code></td><td>✅ Yes</td><td>Single selection from a list</td></tr>
                <tr><td><code>checkbox</code></td><td>✅ Yes</td><td>Multiple selections from a list</td></tr>
                <tr><td><code>dropdown</code></td><td>✅ Yes</td><td>Single selection from a dropdown menu</td></tr>
                <tr><td><code>text</code></td><td>❌ No</td><td>Short text input (single line)</td></tr>
                <tr><td><code>textarea</code></td><td>❌ No</td><td>Long text input (multi-line)</td></tr>
                <tr><td><code>number</code></td><td>❌ No</td><td>Numeric input</td></tr>
                <tr><td><code>email</code></td><td>❌ No</td><td>Email address input</td></tr>
                <tr><td><code>rating</code></td><td>❌ No</td><td>Star rating (1-5)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
    </>
  );
}
