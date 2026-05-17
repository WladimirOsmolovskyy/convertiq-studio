export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface TemplateConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
  };
  typography: {
    fontFamily: string;
  };
  layout: {
    borderRadius: number;
    sectionSpacing: number;
  };
  content: {
    heroTitle: string;
    heroSubtitle: string;
    ctaText: string;
    ctaUrl: string;
    featuresTitle: string;
    features: Array<{ title: string; description: string; icon: string }>;
    footerText: string;
  };
  quiz: {
    enabled: boolean;
    questions: QuizQuestion[];
  };
  results: {
    title: string;
    description: string;
    calendlyUrl: string;
  };
  elementOverrides: Record<string, any>;
}

export const defaultConfig: TemplateConfig = {
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    background: '#0f172a',
    surface: 'rgba(30, 41, 59, 0.7)',
    text: '#f8fafc',
    textMuted: '#94a3b8',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
  },
  layout: {
    borderRadius: 16,
    sectionSpacing: 6,
  },
  content: {
    heroTitle: 'Build Your Dream Website',
    heroSubtitle: 'A breathtaking, modern template designed for conversions and aesthetics.',
    ctaText: 'Start the Quiz',
    ctaUrl: '',
    featuresTitle: 'Why choose our platform',
    features: [
      { title: 'Lightning Fast', description: 'Optimized for speed and performance right out of the box.', icon: '⚡️' },
      { title: 'Fully Customizable', description: 'Adjust every pixel and color to match your brand identity.', icon: '🎨' },
      { title: 'Responsive Design', description: 'Looks incredible on mobile, tablet, and desktop screens.', icon: '📱' },
    ],
    footerText: '© 2024 Website Builder. All rights reserved.',
  },
  quiz: {
    enabled: true,
    questions: [
      { id: 'q1', question: 'What is your primary goal?', options: ['Generate Leads', 'Increase Sales', 'Brand Awareness'] },
      { id: 'q2', question: 'What is your timeline?', options: ['Asap', '1-3 Months', 'Exploring Options'] }
    ]
  },
  results: {
    title: 'Your personalized strategy is ready!',
    description: 'Based on your answers, we recommend booking a discovery call to discuss how our solutions fit your timeline and goals.',
    calendlyUrl: 'https://calendly.com/'
  },
  elementOverrides: {}
};
