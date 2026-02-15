'use client';

import { useState, useRef, useCallback } from 'react';
import type { CategorizedInsight } from './rewireConstants';
import { cardStyles } from './rewireConstants';
import FlashCard from './FlashCard';

const SWIPE_THRESHOLD = 50;  // px to confirm a swipe
const LOCK_ANGLE = 30;        // degrees from vertical to ignore horizontal swipe
const SWIPE_OUT_PX = 300;     // how far the card slides off-screen
const TRANSITION_MS = 200;    // animation duration
const PEEK_WIDTH = 32;        // px visible of neighbor cards on each side

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

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const didSwipeRef = useRef(false);

  const animateSwipeOut = useCallback((direction: number) => {
    setIsAnimating(true);
    // Slide current card off-screen
    setSwipeOffset(direction > 0 ? -SWIPE_OUT_PX : SWIPE_OUT_PX);

    setTimeout(() => {
      // Wrap around for infinite loop
      const nextIndex = wrapIndex(currentIndex + direction, cards.length);
      onIndexChange(nextIndex);
      // Reset instantly (no transition) — new card appears in place
      setIsAnimating(false);
      setSwipeOffset(0);
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
      setSwipeOffset(dx);
    }
  }, [isAnimating]);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      // Commit swipe: swipe left (negative offset) = go to next card
      const direction = swipeOffset < 0 ? 1 : -1;
      animateSwipeOut(direction);
    } else {
      animateSnapBack();
    }

    // Clear swipe guard after a short delay
    setTimeout(() => { didSwipeRef.current = false; }, 100);
  }, [swipeOffset, animateSwipeOut, animateSnapBack]);

  const tapGuard = useCallback(() => didSwipeRef.current, []);

  // Get prev/current/next cards (wrapping for infinite loop)
  const hasMultiple = cards.length > 1;
  const currentCard = cards[currentIndex];
  const prevCard = hasMultiple ? cards[wrapIndex(currentIndex - 1, cards.length)] : null;
  const nextCard = hasMultiple ? cards[wrapIndex(currentIndex + 1, cards.length)] : null;

  // The main card is inset by PEEK_WIDTH on each side to leave room for hints
  const mainInset = hasMultiple ? PEEK_WIDTH : 0;

  return (
    <div className="flex-1 flex flex-col items-center min-h-0">
      {/* Carousel container */}
      <div
        className="relative w-full flex-1 min-h-0 overflow-hidden"
        style={{ maxHeight: '420px' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Previous card hint (left) */}
        {prevCard && (
          <div
            className="absolute top-2 bottom-2 opacity-40 pointer-events-none"
            style={{
              left: 0,
              width: `${PEEK_WIDTH - 4}px`,
              transform: `translateX(${Math.min(swipeOffset * 0.3, 0)}px)`,
              transition: isAnimating ? `transform ${TRANSITION_MS}ms ease-out` : 'none',
            }}
          >
            <div className={`w-full h-full rounded-2xl ${
              cardStyles[prevCard.category].shell
            } shadow-sm scale-[0.92]`} />
          </div>
        )}

        {/* Current card — inset to leave room for peek hints */}
        {currentCard && (
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: `${mainInset}px`,
              right: `${mainInset}px`,
              transform: `translateX(${swipeOffset}px)`,
              transition: isAnimating ? `transform ${TRANSITION_MS}ms ease-out` : 'none',
            }}
          >
            <FlashCard
              key={currentCard.id}
              insight={currentCard}
              isTop={true}
              onTapGuard={tapGuard}
              onEdit={() => onEdit(currentCard)}
              onDelete={() => onDelete(currentCard.id)}
              onRevisit={() => onRevisit(currentCard)}
            />
          </div>
        )}

        {/* Next card hint (right) */}
        {nextCard && (
          <div
            className="absolute top-2 bottom-2 opacity-40 pointer-events-none"
            style={{
              right: 0,
              width: `${PEEK_WIDTH - 4}px`,
              transform: `translateX(${Math.max(swipeOffset * 0.3, 0)}px)`,
              transition: isAnimating ? `transform ${TRANSITION_MS}ms ease-out` : 'none',
            }}
          >
            <div className={`w-full h-full rounded-2xl ${
              cardStyles[nextCard.category].shell
            } shadow-sm scale-[0.92]`} />
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
