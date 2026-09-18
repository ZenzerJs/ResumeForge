import { Variants } from 'framer-motion';

/**
 * Forge Terminal Micro-Animation Variants & Motion Configurations
 * Standardized across the entire application using Framer Motion.
 */

// Ease curves
export const EASE_BLUR_SLIDE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];
export const EASE_LINE_REVEAL: [number, number, number, number] = [0.76, 0, 0.24, 1];
export const EASE_SPRING_CARD = { type: 'spring' as const, stiffness: 300, damping: 22 };
export const EASE_SPRING_BUTTON = { type: 'spring' as const, stiffness: 400, damping: 20 };

/**
 * Viewport Entrance: Blur-Slide-Up Variant
 */
export const blurSlideUpVariants: Variants = {
  initial: {
    opacity: 0,
    filter: 'blur(12px)',
    y: 28,
  },
  animate: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: {
      duration: 0.7,
      ease: EASE_BLUR_SLIDE,
    },
  },
};

/**
 * Reduced Motion Fallback for Entrance
 */
export const reducedBlurSlideUpVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.7,
    },
  },
};

/**
 * Stagger Container Parent Variant
 */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.09,
    },
  },
};

/**
 * Word-by-Word Headline Animation Variant
 */
export const wordAnimationVariants: Variants = {
  initial: {
    filter: 'blur(10px)',
    opacity: 0,
    y: 40,
  },
  animate: {
    filter: ['blur(10px)', 'blur(4px)', 'blur(0px)'],
    opacity: [0, 0.5, 1],
    y: [40, -4, 0],
    transition: {
      duration: 0.7,
      times: [0, 0.5, 1],
    },
  },
};

/**
 * Interactive Card Hover Motion Props
 */
export const cardHoverProps = {
  whileHover: { y: -7, scale: 1.018 },
  transition: EASE_SPRING_CARD,
};

export const cardIconHoverProps = {
  whileHover: { y: -3 },
  transition: { duration: 0.15 },
};

/**
 * Interactive Button Hover Motion Props
 */
export const buttonHoverProps = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.97 },
  transition: EASE_SPRING_BUTTON,
};

export const buttonIconHoverProps = {
  whileHover: { x: 3 },
  transition: { duration: 0.15 },
};

/**
 * Conditional Elements (AnimatePresence)
 */
export const conditionalVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    filter: 'blur(8px)',
    y: 10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    filter: 'blur(4px)',
    y: -6,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * Decorative Line Reveal
 */
export const lineRevealVariants: Variants = {
  initial: {
    scaleX: 0,
    transformOrigin: 'left',
  },
  animate: {
    scaleX: 1,
    transition: {
      duration: 0.9,
      ease: EASE_LINE_REVEAL,
    },
  },
};

/**
 * Media / Image Entrance
 */
export const mediaEntranceVariants: Variants = {
  initial: {
    scale: 0.92,
    opacity: 0,
    filter: 'blur(10px)',
  },
  animate: {
    scale: 1,
    opacity: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.65,
      ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
    },
  },
};
