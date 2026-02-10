'use client';

import { useToney } from '@/context/ToneyContext';
import MobileShell from '@/components/layout/MobileShell';
import {
  OnboardingWelcome,
  OnboardingStory,
  OnboardingQuestions,
  OnboardingPattern,
} from '@/components/onboarding';
import HomeScreen from '@/components/home/HomeScreen';
import ChatScreen from '@/components/chat/ChatScreen';
import RewireScreen from '@/components/rewire/RewireScreen';
import WinsScreen from '@/components/wins/WinsScreen';
import SettingsOverlay from '@/components/layout/SettingsOverlay';
import TabBar from '@/components/layout/TabBar';
import SignInScreen from '@/components/auth/SignInScreen';

export default function ToneyApp() {
  const { appPhase, onboardingStep, activeTab, showSettings } = useToney();

  // Show nothing while checking localStorage
  if (appPhase === 'loading') {
    return (
      <MobileShell>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-4xl animate-pulse">{"\u{1F499}"}</div>
        </div>
      </MobileShell>
    );
  }

  // Not signed in — show sign-in screen
  if (appPhase === 'signed_out') {
    return (
      <MobileShell>
        <SignInScreen />
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      {appPhase === 'onboarding' ? (
        <>
          {onboardingStep === 'welcome' && <OnboardingWelcome />}
          {onboardingStep === 'story' && <OnboardingStory />}
          {onboardingStep === 'questions' && <OnboardingQuestions />}
          {onboardingStep === 'pattern' && <OnboardingPattern />}
        </>
      ) : (
        <>
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'chat' && <ChatScreen />}
          {activeTab === 'rewire' && <RewireScreen />}
          {activeTab === 'wins' && <WinsScreen />}
          {showSettings && <SettingsOverlay />}
          <TabBar />
        </>
      )}
    </MobileShell>
  );
}
