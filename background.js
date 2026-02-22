// Фоновая служба для расширения
let currentWatching = new Map(); // Текущие просматриваемые видео
let liveUpdateInterval = null;

chrome.runtime.onInstalled.addListener(function() {
  console.log('YouTube Social Feed установлен');
  initializeStorage();
  startLiveUpdates();
});

// Инициализация хранилища
function initializeStorage() {
  chrome.storage.local.get(['username', 'isLoggedIn', 'liveFeed', 'isLiveEnabled'], function(result) {
    if (!result.username) {
      chrome.storage.local.set({ username: 'Пользователь' });
    }
    if (result.isLoggedIn === undefined) {
      chrome.storage.local.set({ isLoggedIn: true });
    }
    if (!result.liveFeed) {
      chrome.storage.local.set({ liveFeed: [] });
    }
    if (result.isLiveEnabled === undefined) {
      chrome.storage.local.set({ isLiveEnabled: true });
    }
  });
}

// Запуск обновлений в реальном времени
function startLiveUpdates() {
  if (liveUpdateInterval) {
    clearInterval(liveUpdateInterval);
  }

  liveUpdateInterval = setInterval(() => {
    updateLiveFeed();
  }, 2000); // Обновление каждые 2 секунды
}

// Обновление ленты в реальном времени
function updateLiveFeed() {
  chrome.storage.local.get(['isLiveEnabled'], function(result) {
    if (!result.isLiveEnabled) return;

    const now = Date.now();
    const activeVideos = [];

    // Собираем активные просмотры
    for (const [tabId, videoData] of currentWatching.entries()) {
      // Если видео активно (просмотрено в последние 10 секунд)
      if (now - videoData.lastUpdate < 10000) {
        activeVideos.push({
          ...videoData,
          isLive: true,
          currentTime: videoData.currentTime,
          duration: videoData.duration,
          progress: videoData.currentTime / videoData.duration * 100
        });
      }
    }

    // Обновляем ленту
    chrome.storage.local.set({ liveFeed: activeVideos });

    // Отправляем обновление в popup
    chrome.runtime.sendMessage({
      action: 'liveFeedUpdated',
      videos: activeVideos
    }).catch(() => {
      // Игнорируем ошибки (popup может быть закрыт)
    });
  });
}

// Обработка сообщений от content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'videoWatching') {
    handleVideoWatching(request.videoData, sender.tab.id);
  } else if (request.action === 'videoStopped') {
    handleVideoStopped(sender.tab.id);
  } else if (request.action === 'getLiveStatus') {
    sendResponse({
      isLiveEnabled: true,
      watchingCount: currentWatching.size
    });
  }
});

// Обработка просмотра видео
function handleVideoWatching(videoData, tabId) {
  currentWatching.set(tabId, {
    ...videoData,
    lastUpdate: Date.now(),
    tabId: tabId
  });

  updateLiveFeed();
}

// Обработка остановки просмотра
function handleVideoStopped(tabId) {
  if (currentWatching.has(tabId)) {
    const videoData = currentWatching.get(tabId);

    // Добавляем в историю просмотров
    chrome.storage.local.get(['watchHistory'], function(result) {
      const history = result.watchHistory || [];
      history.unshift({
        ...videoData,
        isLive: false,
        watchedAt: Date.now(),
        watchDuration: Date.now() - videoData.startTime
      });

      // Ограничиваем историю 100 записями
      if (history.length > 100) {
        history.pop();
      }

      chrome.storage.local.set({ watchHistory: history });
    });

    currentWatching.delete(tabId);
    updateLiveFeed();
  }
}

// Обработка закрытия вкладки
chrome.tabs.onRemoved.addListener(function(tabId) {
  handleVideoStopped(tabId);
});

// Обработка обновления вкладки
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    // Если вкладка обновилась и это не YouTube видео, останавливаем отслеживание
    if (!tab.url.includes('youtube.com/watch')) {
      handleVideoStopped(tabId);
    }
  }
});