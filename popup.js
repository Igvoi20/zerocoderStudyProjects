document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

// Инициализация приложения
function initializeApp() {
  loadUserData();
  setupEventListeners();
  startLiveUpdates();
  loadWatchHistory();
}

// Загрузка данных пользователя
function loadUserData() {
  chrome.storage.local.get(['username', 'isLiveEnabled'], function(result) {
    if (result.username) {
      document.getElementById('username').textContent = result.username;
    }

    const liveToggle = document.getElementById('liveToggle');
    if (liveToggle) {
      liveToggle.checked = result.isLiveEnabled !== false;
    }
  });
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Переключение live-режима
  document.getElementById('liveToggle').addEventListener('change', toggleLiveMode);

  // Обновление имени пользователя
  document.getElementById('updateUsername').addEventListener('click', updateUsername);

  // Очистка истории
  document.getElementById('clearHistory').addEventListener('click', clearHistory);
}

// Запуск live-обновлений
function startLiveUpdates() {
  // Загружаем начальные данные
  updateLiveFeed();

  // Обновляем каждые 2 секунды
  setInterval(updateLiveFeed, 2000);

  // Слушаем сообщения от background script
  chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === 'liveFeedUpdated') {
      displayLiveVideos(request.videos);
    }
  });
}

// Обновление live-ленты
function updateLiveFeed() {
  chrome.storage.local.get(['liveFeed', 'isLiveEnabled'], function(result) {
    if (result.isLiveEnabled !== false) {
      displayLiveVideos(result.liveFeed || []);
    } else {
      displayLiveVideos([]);
    }
  });
}

// Отображение live-видео
function displayLiveVideos(videos) {
  const container = document.getElementById('liveVideos');
  const statusElement = document.getElementById('liveStatus');

  if (videos.length > 0) {
    statusElement.textContent = `Сейчас просматривают (${videos.length})`;
    container.innerHTML = '';

    videos.forEach(video => {
      const videoElement = createLiveVideoElement(video);
      container.appendChild(videoElement);
    });
  } else {
    statusElement.textContent = 'Сейчас никто не смотрит видео';
    container.innerHTML = '<div class="no-live">Нет активных просмотров</div>';
  }
}

// Создание элемента live-видео
function createLiveVideoElement(video) {
  const element = document.createElement('div');
  element.className = 'live-video-item';

  const progress = video.currentTime / video.duration * 100;
  const currentTime = formatTime(video.currentTime);
  const duration = formatTime(video.duration);

  element.innerHTML = `
    <div class="video-header">
      <div class="user-info">
        <div class="user-avatar">${video.username?.charAt(0) || 'П'}</div>
        <div class="user-name">${video.username || 'Пользователь'}</div>
      </div>
      <div class="live-badge">
        <div class="live-dot"></div>
        LIVE
      </div>
    </div>

    <div class="video-preview">
      <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
      <div class="video-overlay">
        <div class="play-button">▶</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="time-display">${currentTime} / ${duration}</div>
    </div>

    <div class="video-info">
      <div class="video-title" title="${video.title}">${video.title}</div>
      <div class="video-channel">${video.channel || 'Неизвестный канал'}</div>
    </div>

    <div class="video-actions">
      <button class="watch-btn" data-url="${video.url}">Присоединиться</button>
    </div>
  `;

  // Обработчик кнопки "Присоединиться"
  element.querySelector('.watch-btn').addEventListener('click', function() {
    chrome.tabs.create({ url: video.url });
  });

  // Обработчик клика на превью
  element.querySelector('.video-preview').addEventListener('click', function() {
    chrome.tabs.create({ url: video.url });
  });

  return element;
}

// Загрузка истории просмотров
function loadWatchHistory() {
  chrome.storage.local.get(['watchHistory'], function(result) {
    const history = result.watchHistory || [];
    displayWatchHistory(history);
  });
}

// Отображение истории просмотров
function displayWatchHistory(history) {
  const container = document.getElementById('watchHistory');

  if (history.length > 0) {
    container.innerHTML = '';

    history.slice(0, 10).forEach(video => { // Показываем последние 10
      const element = createHistoryVideoElement(video);
      container.appendChild(element);
    });
  } else {
    container.innerHTML = '<div class="no-history">История просмотров пуста</div>';
  }
}

// Создание элемента видео из истории
function createHistoryVideoElement(video) {
  const element = document.createElement('div');
  element.className = 'history-video-item';

  const date = new Date(video.watchedAt);
  const timeString = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });

  element.innerHTML = `
    <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
    <div class="video-info">
      <div class="video-title" title="${video.title}">${video.title}</div>
      <div class="video-meta">
        <span class="video-channel">${video.channel || 'Неизвестный канал'}</span>
        <span class="video-time">${timeString}</span>
      </div>
    </div>
  `;

  element.addEventListener('click', function() {
    chrome.tabs.create({ url: video.url });
  });

  return element;
}

// Переключение live-режима
function toggleLiveMode() {
  const isEnabled = document.getElementById('liveToggle').checked;
  chrome.storage.local.set({ isLiveEnabled: isEnabled });

  if (!isEnabled) {
    document.getElementById('liveStatus').textContent = 'Трансляция отключена';
    document.getElementById('liveVideos').innerHTML = '<div class="no-live">Трансляция отключена</div>';
  }
}

// Обновление имени пользователя
function updateUsername() {
  const username = prompt('Введите ваше имя для отображения в ленте:');
  if (username && username.trim()) {
    chrome.storage.local.set({ username: username.trim() });
    document.getElementById('username').textContent = username.trim();
  }
}

// Очистка истории
function clearHistory() {
  if (confirm('Очистить историю просмотров?')) {
    chrome.storage.local.set({ watchHistory: [] });
    document.getElementById('watchHistory').innerHTML = '<div class="no-history">История просмотров пуста</div>';
  }
}

// Форматирование времени
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}