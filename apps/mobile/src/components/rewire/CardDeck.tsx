'use client';

import { useState, useRef, useCallback } from 'react';
import type { CategorizedInsight } from './rewireConstants';
import FlashCard from './FlashCard';

const SWIPE_THRESHOLD = 50;  // px to confirm a swipe
const LOCK_ANGLE = 30;        // degrees from vertical to ignore horizontal swipe
const SWIPE_OUT_PX = 300;     // how far the card flies off-screen
const TRANSITION_MS = 200;    // animation duration

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

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const didSwipeRef = useRef(false);

  const animateSwipeOut = useCallback((direction: number) => {
    setIsAnimating(true);
    setSwipeOffset(direction > 0 ? -SWIPE_OUT_PX : SWIPE_OUT_PX);

    setTimeout(() => {
      const nextIndex = currentIndex + direction;
      const clampedIndex = Math.max(0, Math.min(nextIndex, cards.length - 1));
      onIndexChange(clampedIndex);
      setSwipeOffset(0);
      setIsAnimating(false);
    }, TRANSITION_MS);
  }, [currentIndex, cards.length, onIndexChange]);

  const animateSnapBack = useCallback(() => {
    setIsAnimating(true);
    setSwipeOffset(0);
    setTimeout(() => setIsAnimating(false), TRANSITION_MS);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isDragging.current = false;
    didSwipeRef.current = false;
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
      // Edge resistance at boundaries
      let clampedDx = dx;
      if (dx > 0 && currentIndex === 0) clampedDx = dx / 3;
      if (dx < 0 && currentIndex === cards.length - 1) clampedDx = dx / 3;
      setSwipeOffset(clampedDx);
    }
  }, [isAnimating, currentIndex, cards.length]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      // Commit swipe: swipe left (negative offset) = go to next card
      const direction = swipeOffset < 0 ? 1 : -1;
      // Don't go past boundaries
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= cards.length) {
        animateSnapBack();
      } else {
        animateSwipeOut(direction);
      }
    } else {
      animateSnapBack();
    }

    // Clear swipe guard after a short delay
    setTimeout(() => { didSwipeRef.current = false; }, 100);
  }, [swipeOffset, currentIndex, cards.length, animateSwipeOut, animateSnapBack]);

  const tapGuard = useCallback(() => didSwipeRef.current, []);

  // Show up to 3 cards: current + 2 behind for depth
  const visibleCards = cards.slice(currentIndex, currentIndex + 3);

  return (
    <div className="flex-1 flex flex-col items-center min-h-0">
      {/* Deck container */}
      <div
        className="relative w-full flex-1 min-h-0"
        style={{ maxHeight: '420px' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {visibleCards.map((card, stackIndex) => {
          const isTop = stackIndex === 0;
          const scale = 1 - stackIndex * 0.04;
          const translateY = stackIndex * 8;
          const opacity = 1 - stackIndex * 0.15;
          const zIndex = 3 - stackIndex;

          const cardStyle: React.CSSProperties = isTop
            ? {
                transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.05}deg)`,
                transition: isAnimating ? `transform ${TRANSITION_MS}ms ease-out` : 'none',
                opacity,
                zIndex,
              }
            : {
                transform: `translateY(${translateY}px) scale(${scale})`,
                transition: `transform ${TRANSITION_MS + 100}ms ease-out`,
                opacity,
                zIndex,
                pointerEvents: 'none' as const,
              };

          return (
            <FlashCard
              key={card.id}
              insight={card}
              isTop={isTop}
              style={cardStyle}
              onTapGuard={tapGuard}
              onEdit={() => onEdit(card)}
              onDelete={() => onDelete(card.id)}
              onRevisit={() => onRevisit(card)}
            />
          );
        }).reverse() /* render bottom cards first so top card is last in DOM (on top) */}
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
