'use client';

import { useEffect, useState } from 'react';
import { Icon, Button } from '@/components/elements/export';
import { browserStorage, readDismissed, writeDismissed } from '@buxa/shared/install/dismissal';
import { PHONE_QUERY, installPlatform, shouldShowInstallHint, type InstallPlatform } from '@buxa/shared/install/installRules';

/** The event Android Chrome fires when the app can be installed. It is not in the standard DOM typings. */
interface InstallPromptEvent extends Event { prompt: () => Promise<void> }

/** Steps for the phone's browser, in words. Shown to signed-in people on a phone only, and it can be dismissed for good. */
export function InstallHint() {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  // Decided after mount: the server does not know the device, so it renders nothing and the hint appears on the phone.
  useEffect(() => {
    const phone = window.matchMedia(PHONE_QUERY).matches;
    const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    const found = installPlatform(navigator.userAgent, navigator.maxTouchPoints);
    const dismissed = readDismissed(browserStorage());
    setPlatform(found);
    setVisible(shouldShowInstallHint({ platform: found, phone, installed, dismissed }));
    // Android Chrome offers the install prompt once; keeping the event lets the hint's button show it.
    const onPrompt = (event: Event) => {
      event.preventDefault(); setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible || platform === null) {
    return null;
  }

  const dismiss = () => {
    // If the browser refuses storage, the hint stays hidden for this page view only.
    writeDismissed(browserStorage());
    setVisible(false);
  };

  const install = () => {
    if (!prompt) {
      return;
    }
    void prompt.prompt();
    setPrompt(null);
  };

  return (
    <aside className="install-hint" aria-labelledby="install-hint-title">
      <div className="install-hint-body">
        <p id="install-hint-title" className="install-hint-title">
          <Icon name="download" size={16} /> Add Buxa to your home screen
        </p>
        {platform === 'ios' ? (
          <p className="muted">In Safari, tap the Share button, then Add to Home Screen.</p>
        ) : (
          <p className="muted">{prompt ? 'Install Buxa for one-tap access at the door.' : 'In Chrome, open the menu and tap Install app.'}</p>
        )}
      </div>
      <div className="install-hint-actions">
        {prompt && platform === 'android' && <Button variant="primary" type="button" onClick={install}>Install</Button>}
        <Button variant="ghost" type="button" onClick={dismiss}>Not now</Button>
      </div>
    </aside>
  );
}
