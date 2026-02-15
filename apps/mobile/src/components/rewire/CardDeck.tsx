'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { CategorizedInsight } from './rewireConstants';
import FlashCard from './FlashCard';

const VELOCITY_THRESHOLD = 0.3;  // px/ms — a quick flick commits
const LOCK_ANGLE = 30;           // degrees from vertical to ignore horizontal swipe
const BASE_DURATION = 300;       // ms — base animation duration
const MIN_DURATION = 150;        // ms — fastest possible animation
const MAX_DURATION = 350;        // ms — slowest animation

// ── Dot Indicators ──

function DotIndicators({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (index: number) => void;
}) {
  const MAX_DOTS = 7;
  let startDot = 0;
  let endDot = total;

  if (total > MAX_DOTS) {
    startDot = Math.max(0, current - Math.floor(MAX_DOTS / 2));
    endDot = startDot + MAX_DOTS;
    if (endDot > total) {
      endDot = total;
      startDot = endDot - MAX_DOTS;
    }
  }

  const dots = [];
  for (let i = startDot; i < endDot; i++) {
    const isActive = i === current;
    const distance = Math.abs(i - current);
    const sizeClass = distance === 0
      ? 'w-2 h-2'
      : distance === 1
        ? 'w-1.5 h-1.5'
        : 'w-1 h-1';

    dots.push(
      <button
        key={i}
        onClick={() => onDotClick(i)}
        className={`rounded-full transition-all duration-200 ${sizeClass} ${
          isActive ? 'bg-indigo-500' : 'bg-gray-300'
        }`}
        aria-label={`Go to card ${i + 1}`}
      />
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5 py-4">
      {dots}
    </div>
  );
}

// ── Wrap index for infinite loop ──

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

// ── Card Deck ──

interface CardDeckProps {
  cards: CategorizedInsight[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onEdit: (card: CategorizedInsight) => void;
  onDelete: (id: string) => void;
  onRevisit: (card: CategorizedInsight) => void;
}

export default function CardDeck({
  cards,
  currentIndex,
  onIndexChange,
  onEdit,
  onDelete,
  onRevisit,
}: CardDeckProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [transitionDuration, setTransitionDuration] = useState(BASE_DURATION);

  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const didSwipeRef = useRef(false);

  // Velocity tracking
  const velocityRef = useRef(0);
  const lastTouchX = useRef(0);
  const lastTouchTime = useRef(0);

  // Pending snap callback (for transitionend)
  const pendingSnap = useRef<(() => void) | null>(null);

  // Measure container width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Execute the pending snap (shared by transitionend + safety timeout)
  const executePendingSnap = useCallback(() => {
    if (pendingSnap.current) {
      pendingSnap.current();
      pendingSnap.current = null;
    }
  }, []);

  const animateSwipeOut = useCallback((direction: number) => {
    if (!containerWidth) return;

    // Calculate dynamic duration based on remaining distance
    const remaining = containerWidth - Math.abs(swipeOffset);
    const ratio = remaining / containerWidth;
    const dynamicDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, ratio * BASE_DURATION));

    setTransitionDuration(dynamicDuration);
    setIsAnimating(true);
    // Animate strip to show prev or next slot
    setSwipeOffset(direction > 0 ? -containerWidth : containerWidth);

    // Set up the snap callback
    pendingSnap.current = () => {
      const nextIndex = wrapIndex(currentIndex + direction, cards.length);
      onIndexChange(nextIndex);
      // Reset instantly — strip snaps back to center slot showing NEW current
      setIsAnimating(false);
      setSwipeOffset(0);
      setTransitionDuration(BASE_DURATION);
    };

    // Safety timeout fallback (in case transitionend doesn't fire)
    setTimeout(() => {
      executePendingSnap();
    }, dynamicDuration + 50);
  }, [currentIndex, cards.length, onIndexChange, containerWidth, swipeOffset, executePendingSnap]);

  const animateSnapBack = useCallback(() => {
    // Dynamic duration for snap-back too
    const ratio = Math.abs(swipeOffset) / (containerWidth || 1);
    const dynamicDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, ratio * BASE_DURATION));

    setTransitionDuration(dynamicDuration);
    setIsAnimating(true);
    setSwipeOffset(0);

    pendingSnap.current = () => {
      setIsAnimating(false);
      setTransitionDuration(BASE_DURATION);
    };

    setTimeout(() => {
      executePendingSnap();
    }, dynamicDuration + 50);
  }, [swipeOffset, containerWidth, executePendingSnap]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isDragging.current = false;
    didSwipeRef.current = false;
    // Initialize velocity tracking
    velocityRef.current = 0;
    lastTouchX.current = touch.clientX;
    lastTouchTime.current = Date.now();
  }, [isAnimating]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    // Lock direction on first significant movement
    if (!isDragging.current) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 10) return;
      const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      // If movement is mostly vertical, don't intercept
      if (angle > (90 - LOCK_ANGLE) && angle < (90 + LOCK_ANGLE)) return;
      isDragging.current = true;
      didSwipeRef.current = true;
    }

    if (isDragging.current) {
      e.preventDefault();
      setSwipeOffset(dx);

      // Track velocity
      const now = Date.now();
      const dt = now - lastTouchTime.current;
      if (dt > 0) {
        velocityRef.current = (touch.clientX - lastTouchX.current) / dt;
      }
      lastTouchX.current = touch.clientX;
      lastTouchTime.current = now;
    }
  }, [isAnimating]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const velocity = velocityRef.current;
    const distanceThreshold = containerWidth * 0.25; // 25% of card width

    // Commit if fast flick OR dragged far enough
    const shouldCommit =
      Math.abs(velocity) > VELOCITY_THRESHOLD ||
      Math.abs(swipeOffset) > distanceThreshold;

    if (shouldCommit) {
      // Use velocity direction if significant, otherwise use offset direction
      const direction = Math.abs(velocity) > VELOCITY_THRESHOLD
        ? (velocity < 0 ? 1 : -1)
        : (swipeOffset < 0 ? 1 : -1);
      animateSwipeOut(direction);
    } else {
      animateSnapBack();
    }

    setTimeout(() => { didSwipeRef.current = false; }, 100);
  }, [swipeOffset, containerWidth, animateSwipeOut, animateSnapBack]);

  const handleTransitionEnd = useCallback(() => {
    executePendingSnap();
  }, [executePendingSnap]);

  const tapGuard = useCallback(() => didSwipeRef.current, []);

  // Get prev/current/next cards (wrapping for infinite loop)
  const hasMultiple = cards.length > 1;
  const currentCard = cards[currentIndex];
  const prevCard = hasMultiple ? cards[wrapIndex(currentIndex - 1, cards.length)] : null;
  const nextCard = hasMultiple ? cards[wrapIndex(currentIndex + 1, cards.length)] : null;

  // Strip offset: center slot (slot 1) is at -containerWidth, plus swipeOffset for drag
  const stripTranslateX = hasMultiple
    ? -containerWidth + swipeOffset
    : 0;

  return (
    <div className="flex-1 flex flex-col items-center min-h-0">
      {/* Carousel container — clips to one card width */}
      <div
        ref={containerRef}
        className="relative w-full flex-1 min-h-0 overflow-hidden"
        style={{ maxHeight: '420px' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {containerWidth > 0 && (
          <div
            ref={stripRef}
            onTransitionEnd={handleTransitionEnd}
            style={{
              display: 'flex',
              width: hasMultiple ? containerWidth * 3 : containerWidth,
              height: '100%',
              transform: `translateX(${stripTranslateX}px)`,
              transition: isAnimating
                ? `transform ${transitionDuration}ms cubic-bezier(0.25, 1, 0.5, 1)`
                : 'none',
            }}
          >
            {/* Slot 0: previous card */}
            {hasMultiple && (
              <div style={{ width: containerWidth, height: '100%', flexShrink: 0, position: 'relative' }}>
                {prevCard && (
                  <FlashCard
                    key={`prev-${prevCard.id}`}
                    insight={prevCard}
                    isTop={false}
                    onTapGuard={tapGuard}
                    onEdit={() => onEdit(prevCard)}
                    onDelete={() => onDelete(prevCard.id)}
                    onRevisit={() => onRevisit(prevCard)}
                  />
                )}
              </div>
            )}

            {/* Slot 1 (or 0 if single): current card */}
            <div style={{ width: containerWidth, height: '100%', flexShrink: 0, position: 'relative' }}>
              {currentCard && (
                <FlashCard
                  key={currentCard.id}
                  insight={currentCard}
                  isTop={true}
                  onTapGuard={tapGuard}
                  onEdit={() => onEdit(currentCard)}
                  onDelete={() => onDelete(currentCard.id)}
                  onRevisit={() => onRevisit(currentCard)}
                />
              )}
            </div>

            {/* Slot 2: next card */}
            {hasMultiple && (
              <div style={{ width: containerWidth, height: '100%', flexShrink: 0, position: 'relative' }}>
                {nextCard && (
                  <FlashCard
                    key={`next-${nextCard.id}`}
                    insight={nextCard}
                    isTop={false}
                    onTapGuard={tapGuard}
                    onEdit={() => onEdit(nextCard)}
                    onDelete={() => onDelete(nextCard.id)}
                    onRevisit={() => onRevisit(nextCard)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {cards.length > 1 && (
        <div className="flex-shrink-0">
          <DotIndicators
            total={cards.length}
            current={currentIndex}
            onDotClick={onIndexChange}
          />
        </div>
      )}
    </div>
  );
}
