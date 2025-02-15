/*
   Copyright 2019 Marc Nuri San Felix

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */
import {jest} from '@jest/globals';
import {fireEvent, waitFor} from '@testing-library/dom';
import htm from 'htm';

const mockDOM = () => {
  document.body.innerHTML = '';
  const $root = document.createElement('div');
  $root.innerHTML = '<div class="settings container is-fluid"></div>';
  document.body.append($root);
};

describe('Settings in Browser test suite', () => {
  let mockDictionariesAvailableNative;
  let mockDictionariesAvailable;
  let mockDictionariesEnabled;
  let mockCurrentSettings;
  let mockIpcRenderer;
  beforeEach(async () => {
    jest.resetModules();
    mockDictionariesAvailableNative = ['en'];
    mockDictionariesAvailable = {
      en: {name: 'English'},
      es: {name: 'Spanish'}
    };
    mockDictionariesEnabled = ['en'];
    mockCurrentSettings = {
      disableNotificationsGlobally: false,
      tabs: [
        {id: '1', url: 'https://initial-tab.com', sandboxed: true},
        {id: '2', url: 'https://initial-tab-2.com', disabled: true, disableNotifications: true}
      ]
    };
    mockIpcRenderer = {
      send: jest.fn(),
      invoke: jest.fn(async channel => {
        switch (channel) {
          case 'settingsLoad':
            return mockCurrentSettings;
          case 'dictionaryGetAvailableNative':
            return mockDictionariesAvailableNative;
          case 'dictionaryGetAvailable':
            return mockDictionariesAvailable;
          case 'dictionaryGetEnabled':
            return mockDictionariesEnabled;
          default:
            return {};
        }
      })
    };
    window.preact = await import('preact');
    window.preactHooks = await import('preact/hooks');
    window.html = htm.bind(window.preact.h);
    window.TopBar = (await import('../../components')).default.topBar(window.html);
    window.APP_EVENTS = (await import('../../constants')).APP_EVENTS;
    window.ELECTRONIM_VERSION = '1.33.7';
    window.ipcRenderer = mockIpcRenderer;
    mockDOM();
    await import('../settings.browser');
  });
  describe('Main Button events', () => {
    test('Submit should send form data', () => {
      // When
      fireEvent.click(document.querySelector('.settings__submit'));
      // Then
      expect(mockIpcRenderer.send).toHaveBeenCalledTimes(1);
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('settingsSave',
        {
          tabs: [
            {id: '1', url: 'https://initial-tab.com', sandboxed: true},
            {id: '2', url: 'https://initial-tab-2.com', disabled: true, disableNotifications: true}
          ],
          enabledDictionaries: ['en'],
          disableNotificationsGlobally: false
        });
    });
    test('Cancel should send close dialog event', () => {
      // When
      fireEvent.click(document.querySelector('.settings__cancel'));
      // Then
      expect(mockIpcRenderer.send).toHaveBeenCalledTimes(1);
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('closeDialog');
    });
    test('Toggle global notifications should check input', async () => {
      // Given
      const $notificationCheckbox = document.querySelector('.settings__global-notifications input');
      expect($notificationCheckbox.checked).toBe(false);
      // When
      fireEvent.click($notificationCheckbox);
      // Then
      await waitFor(() => {
        expect($notificationCheckbox.checked).toBe(true);
      });
    });
  });
  describe('New tab Input field', () => {
    let $tabContainer;
    let $input;
    let $addTabButton;
    let $submitButton;
    beforeEach(() => {
      $input = document.querySelector('.settings__new-tab input[type="text"].input');
      $addTabButton = document.querySelector('.settings__new-tab .button');
      $tabContainer = document.querySelector('.settings__tabs');
      $submitButton = document.querySelector('.settings__submit');
    });
    test('key* events, Regular key press (No Enter), should only update input value', async () => {
      // When
      fireEvent.keyDown($input, {code: 'A'});
      fireEvent.keyPress($input, {code: 'A'});
      fireEvent.keyUp($input, {code: 'A'});
      fireEvent.input($input, {target: {value: 'A'}});
      // Then
      await waitFor(() => expect($input.value).toBe('A'));
      expect($tabContainer.childElementCount).toBe(2);
    });
    describe('keydown event, Enter key with URLS', () => {
      test('Empty URL, should do nothing', async () => {
        // Given
        fireEvent.input($input, {target: {value: ''}});
        // When
        fireEvent.keyDown($input, {code: 'Enter'});
        // Then
        expect($tabContainer.childElementCount).toBe(2);
        expect($addTabButton.hasAttribute('disabled')).toBe(true);
        expect($submitButton.hasAttribute('disabled')).toBe(false);
      });
      test('Invalid URL, should set input invalid', async () => {
        // Given
        fireEvent.input($input, {target: {value: 'invalid:1337:url'}});
        // When
        fireEvent.keyDown($input, {code: 'Enter'});
        // Then
        expect($tabContainer.childElementCount).toBe(2);
        await waitFor(() =>
          expect($input.classList.contains('is-danger')).toBe(true));
        expect($tabContainer.querySelectorAll('.settings__tab .settings__tab-main input').length).toBe(2);
        expect($input.value).toBe('invalid:1337:url');
        expect($addTabButton.hasAttribute('disabled')).toBe(true);
        expect($submitButton.hasAttribute('disabled')).toBe(true);
      });
      test('Valid URL without protocol, should add new url with default protocol', async () => {
        // Given
        fireEvent.input($input, {target: {value: 'info.cern.ch'}});
        // When
        fireEvent.keyDown($input, {code: 'Enter'});
        // Then
        await waitFor(() =>
          expect($tabContainer.childElementCount).toBe(3));
        expect($input.classList.contains('is-success')).toBe(false);
        expect($tabContainer.querySelectorAll('.settings__tab .settings__tab-main input')[2].value)
          .toBe('https://info.cern.ch');
        expect($input.value).toBe('');
        expect($addTabButton.hasAttribute('disabled')).toBe(true);
        expect($submitButton.hasAttribute('disabled')).toBe(false);
      });
      test('Valid URL wth protocol, should add new url with specified protocol', async () => {
        // Given
        fireEvent.input($input, {target: {value: 'http://info.cern.ch'}});
        // When
        fireEvent.keyDown($input, {code: 'Enter'});
        // Then
        await waitFor(() =>
          expect($tabContainer.childElementCount).toBe(3));
        await waitFor(() =>
          expect($input.classList.contains('is-success')).toBe(false));
        expect($tabContainer.querySelectorAll('.settings__tab .settings__tab-main input')[2].value)
          .toBe('http://info.cern.ch');
        expect($input.value).toBe('');
        expect($addTabButton.hasAttribute('disabled')).toBe(true);
        expect($submitButton.hasAttribute('disabled')).toBe(false);
      });
    });
    describe('input event', () => {
      test('Valid URL, should add success class', async () => {
        // When
        fireEvent.input($input, {target: {value: 'http://info.cern.ch'}});
        // Then
        await waitFor(() =>
          expect($input.classList.contains('is-success')).toBe(true));
        expect($input.classList.contains('is-danger')).toBe(false);
        expect($addTabButton.hasAttribute('disabled')).toBe(false);
        expect($submitButton.hasAttribute('disabled')).toBe(true);
      });
      test('Invalid URL, should add danger class', async () => {
        // When
        fireEvent.input($input, {target: {value: 'http://invalid:1337:url'}});
        // Then
        await waitFor(() =>
          expect($input.classList.contains('is-danger')).toBe(true));
        expect($input.classList.contains('is-success')).toBe(false);
        expect($addTabButton.hasAttribute('disabled')).toBe(true);
        expect($submitButton.hasAttribute('disabled')).toBe(true);
      });
    });
    test('addTabButton, click with valid URL, should add tab', async () => {
      // Given
      fireEvent.input($input, {target: {value: 'info.cern.ch'}});
      // When
      fireEvent.click($addTabButton);
      // Then
      await waitFor(() =>
        expect($tabContainer.childElementCount).toBe(3));
      expect($tabContainer.querySelectorAll('.settings__tab .settings__tab-main input')[2].value)
        .toBe('https://info.cern.ch');
      expect($input.value).toBe('');
      expect($addTabButton.hasAttribute('disabled')).toBe(true);
      expect($submitButton.hasAttribute('disabled')).toBe(false);
    });
  });
  describe('Tab events', () => {
    describe('Disable icon click', () => {
      let $disableIcon;
      beforeEach(() => {
        $disableIcon = document.querySelector('.settings__tabs .icon .fa-eye');
      });
      test('with enabled tab, should disable', async () => {
        // When
        fireEvent.click($disableIcon);
        // Then
        await waitFor(() => expect($disableIcon.classList.contains('fa-eye')).toBe(false));
        expect($disableIcon.classList.contains('fa-eye-slash')).toBe(true);
      });
      test('with disabled tab, should enable', async () => {
        // When
        fireEvent.click($disableIcon);
        // Then
        await waitFor(() => expect($disableIcon.classList.contains('fa-eye-slash')).toBe(false));
        expect($disableIcon.classList.contains('fa-eye')).toBe(true);
      });
    });
    test('Notification disabled icon click, should enable notification', async () => {
      // Given
      const $notificationEnabledIcon = document.querySelector('.settings__tabs .icon .fa-bell-slash');
      // When
      fireEvent.click($notificationEnabledIcon);
      // Then
      await waitFor(() =>
        expect($notificationEnabledIcon.classList.contains('fa-bell-slash')).toBe(false));
      expect($notificationEnabledIcon.classList.contains('fa-bell')).toBe(true);
    });
    test('Notification enabled icon click, should disable notification', async () => {
      // Given
      const $notificationEnabledIcon = document.querySelector('.settings__tabs .icon .fa-bell');
      // When
      fireEvent.click($notificationEnabledIcon);
      // Then
      await waitFor(() =>
        expect($notificationEnabledIcon.classList.contains('fa-bell')).toBe(false));
      expect($notificationEnabledIcon.classList.contains('fa-bell-slash')).toBe(true);
    });
    test('Trash icon click, should remove tab', async () => {
      // Given
      const $tabContainer = document.querySelector('.settings__tabs');
      const $trashIcon = $tabContainer.querySelector('.icon .fa-trash');
      const initialChildren = $tabContainer.childElementCount;
      expect(initialChildren).toBeGreaterThan(0);
      // When
      fireEvent.click($trashIcon);
      // Then
      await waitFor(() =>
        expect($tabContainer.childElementCount).toBe(initialChildren - 1));
    });
    describe('Expand/Collapse icon click', () => {
      test('collapsed tab, should expand tab', async () => {
        // Given
        const $expandIcon = document.querySelector('.settings__tab[data-id="1"] .icon .fa-chevron-right');
        const $collapsedTab = $expandIcon.closest('.settings__tab');
        expect($collapsedTab.classList.contains('settings__tab--expanded')).toBe(false);
        // When
        fireEvent.click($expandIcon);
        // Then
        await waitFor(() =>
          expect($expandIcon.classList.contains('fa-chevron-down')).toBe(true));
        expect($collapsedTab.classList.contains('settings__tab--expanded')).toBe(true);
      });
      test('expanded tab, should collapse tab', async () => {
        // Given
        const $tabIcon = document.querySelector('.settings__tab[data-id="2"] .icon');
        fireEvent.click($tabIcon);
        await waitFor(() => expect($tabIcon.title).toEqual('Collapse'));
        const $expandedTab = $tabIcon.closest('.settings__tab');
        expect($expandedTab.classList.contains('settings__tab--expanded')).toBe(true);
        const $collapseIcon = $tabIcon.querySelector('.fa-chevron-down');
        // When
        fireEvent.click($collapseIcon);
        // Then
        await waitFor(() =>
          expect($collapseIcon.classList.contains('fa-chevron-right')).toBe(true));
        expect($expandedTab.classList.contains('settings__tab--expanded')).toBe(false);
      });
      describe('Advanced settings', () => {
        test('Sandbox checkbox click, sandboxed session, should unlock', async () => {
          // Given
          const $tabIcon = document.querySelector('.settings__tab[data-id="1"] .icon');
          fireEvent.click($tabIcon);
          await waitFor(() => expect($tabIcon.title).toEqual('Collapse'));
          const $lockCheckBox = document.querySelector('.settings__tab-advanced .checkbox .fa-lock');
          // When
          fireEvent.click($lockCheckBox);
          // Then
          await waitFor(() =>
            expect($lockCheckBox.classList.contains('fa-lock')).toBe(false));
          expect($lockCheckBox.classList.contains('fa-lock-open')).toBe(true);
        });
        test('Sandbox checkbox click, non-sandboxed session, should lock', async () => {
          // Given
          const $tabIcon = document.querySelector('.settings__tab[data-id="2"] .icon');
          fireEvent.click($tabIcon);
          await waitFor(() => expect($tabIcon.title).toEqual('Collapse'));
          const $lockCheckBox = document.querySelector('.settings__tab-advanced .checkbox .fa-lock-open');
          // When
          fireEvent.click($lockCheckBox);
          // Then
          await waitFor(() =>
            expect($lockCheckBox.classList.contains('fa-lock-open')).toBe(false));
          expect($lockCheckBox.classList.contains('fa-lock')).toBe(true);
        });
      });
    });
    describe('URL edit', () => {
      let $input;
      let $submitButton;
      beforeEach(() => {
        $input = document.querySelector('.settings__tab[data-id="1"] .input');
        $submitButton = document.querySelector('.settings__submit');
      });
      test('with valid URL, should enable save button', async () => {
        // When
        fireEvent.input($input, {target: {value: 'https://info.cern.ch'}});
        // Then
        await waitFor(() => expect($submitButton.hasAttribute('disabled')).toBe(false));
      });
      test('with invalid URL, should disable save button', async () => {
        // When
        fireEvent.input($input, {target: {value: 'missing-protocol-info.cern.ch'}});
        // Then
        await waitFor(() => expect($submitButton.hasAttribute('disabled')).toBe(true));
      });
    });
  });
  describe('Spell Check events', () => {
    let $spellCheckContainer;
    beforeEach(() => {
      $spellCheckContainer = document.querySelector('.settings__spell-check');
    });
    test('toggle use native spell checker, should check use native spell checker', async () => {
      // Given
      const $useNativeSpellChecker = $spellCheckContainer
        .querySelector('.settings__spell-check-common input[data-testid=use-native-spell-checker]');
      expect($useNativeSpellChecker.checked).toBe(false);
      // When
      fireEvent.click($useNativeSpellChecker);
      // Then
      await waitFor(() => expect($useNativeSpellChecker.checked).toBe(true));
    });
    describe('dictionaries', () => {
      let $dictionaries;
      beforeEach(() => {
        $dictionaries = $spellCheckContainer.querySelector('.settings__dictionaries');
      });
      test('toggle active dictionary, should uncheck dictionary', async () => {
        // Given
        const $enDict = $dictionaries.querySelector('input[value=en]');
        expect($enDict.checked).toBe(true);
        // When
        fireEvent.click($enDict);
        // Then
        await waitFor(() => expect($enDict.checked).toBe(false));
      });
      test('toggle inactive dictionary, should check dictionary', async () => {
        // Given
        const $esDict = $dictionaries.querySelector('input[value=es]');
        expect($esDict.checked).toBe(false);
        // When
        fireEvent.click($esDict);
        // Then
        await waitFor(() => expect($esDict.checked).toBe(true));
      });
      test('when not native, dictionaries should intersect available', async () => {
        await waitFor(() => expect($dictionaries.querySelectorAll('input').length).toBe(2));
      });
      test('when native, dictionaries should intersect available', async () => {
        // Given
        const $useNativeSpellChecker = $spellCheckContainer
          .querySelector('.settings__spell-check-common input[data-testid=use-native-spell-checker]');
        // When
        fireEvent.click($useNativeSpellChecker);
        // Then
        await waitFor(() => expect($dictionaries.querySelectorAll('input').length).toBe(1));
      });
    });
  });
});
