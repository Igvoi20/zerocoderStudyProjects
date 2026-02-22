// Контентный скрипт для отслеживания просмотра в реальном времени

let currentVideoId = null;
let videoCheckInterval = null;
let lastVideoData = null;

// Основная функция отслеживания
function startVideoTracking() {
  const video = document.querySelector('video');
  if (!video) return;

  const newVideoId = getCurrentVideoId();

  // Если видео изменилось
  if (newVideoId && newVideoId !== currentVideoId) {
    currentVideoId = newVideoId;
    lastVideoData = null;

    // Останавливаем предыдущий интервал
    if (videoCheckInterval) {
      clearInterval(videoCheckInterval);
    }

    // Запускаем отслеживание каждую секунду
    videoCheckInterval = setInterval(trackVideoPlayback, 1000);

    // Добавляем обработчики событий видео
    video.addEventListener('play', handleVideoPlay);
    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('ended', handleVideoEnd);

    // Добавляем кнопку в интерфейс YouTube
    addYouTubeIntegration();
  }
}

// Отслеживание воспроизведения видео
function trackVideoPlayback() {
  const video = document.querySelector('video');
  if (!video || video.paused || video.ended) return;

  const videoData = getVideoData();
  if (!videoData) return;

  // Отправляем данные только если они изменились
  if (!lastVideoData ||
      lastVideoData.currentTime !== videoData.currentTime ||
      lastVideoData.isPlaying !== videoData.isPlaying) {

    chrome.runtime.sendMessage({
      action: 'videoWatching',
      videoData: videoData
    });

    lastVideoData = videoData;
  }
}

// Обработчик начала воспроизведения
function handleVideoPlay() {
  const videoData = getVideoData();
  if (videoData) {
    chrome.runtime.sendMessage({
      action: 'videoWatching',
      videoData: videoData
    });
  }
}

// Обработчик паузы
function handleVideoPause() {
  chrome.runtime.sendMessage({
    action: 'videoStopped'
  });
}

// Обработчик окончания видео
function handleVideoEnd() {
  chrome.runtime.sendMessage({
    action: 'videoStopped'
  });
}

// Получение данных о видео
function getVideoData() {
  const video = document.querySelector('video');
  if (!video) return null;

  const videoId = getCurrentVideoId();
  if (!videoId) return null;

  const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                      document.querySelector('h1 yt-formatted-string') ||
                      document.querySelector('h1.title');

  const title = titleElement ? titleElement.textContent.trim() : 'Неизвестное видео';

  return {
    id: videoId,
    title: title,
    url: window.location.href,
    currentTime: video.currentTime,
    duration: video.duration,
    isPlaying: !video.paused && !video.ended,
    startTime: Date.now(),
    thumbnail: `https://img.youtube.com/vi/${videoId}/default.jpg`,
    channel: getChannelName(),
    lastUpdate: Date.now()
  };
}

// Получение названия канала
function getChannelName() {
  const channelElement = document.querySelector('#channel-name a') ||
                        document.querySelector('#owner-channel-name') ||
                        document.querySelector('.ytd-channel-name a');

  return channelElement ? channelElement.textContent.trim() : 'Неизвестный канал';
}

// Получение ID текущего видео
function getCurrentVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

// Интеграция с интерфейсом YouTube
function addYouTubeIntegration() {
  // Добавляем индикатор трансляции
  addLiveIndicator();

  // Добавляем информацию о социальной ленте
  addSocialFeedInfo();
}

// Добавление индикатора трансляции
function addLiveIndicator() {
  if (document.getElementById('yt-social-live-indicator')) return;

  const container = document.querySelector('#above-the-fold') ||
                   document.querySelector('#primary-inner') ||
                   document.querySelector('#container');

  if (container) {
    const indicator = document.createElement('div');
    indicator.id = 'yt-social-live-indicator';
    indicator.innerHTML = `
      <div style="
        background: linear-gradient(45deg, #ff0000, #ff6b6b);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 10px 0;
        animation: pulse 2s infinite;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          animation: blink 1.5s infinite;
        "></div>
        🔴 Трансляция в ленте
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    `;

    // Вставляем в начало контейнера
    container.insertBefore(indicator, container.firstChild);
  }
}

// Добавление информации о социальной ленте
function addSocialFeedInfo() {
  const description = document.querySelector('#description');
  if (description && !document.getElementById('yt-social-feed-info')) {
    const info = document.createElement('div');
    info.id = 'yt-social-feed-info';
    info.innerHTML = `
      <div style="
        background: #f0f0f0;
        padding: 12px;
        border-radius: 8px;
        margin: 10px 0;
        font-size: 14px;
        border-left: 4px solid #ff0000;
      ">
        <strong>👥 Социальная лента</strong><br>
        Ваши друзья видят, что вы смотрите это видео в реальном времени!
      </div>
    `;
    description.parentNode.insertBefore(info, description);
  }
}

// Отслеживание изменений URL (SPA навигация в YouTube)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (url.includes('/watch')) {
      setTimeout(startVideoTracking, 1000);
    } else {
      // Если ушли со страницы видео, останавливаем отслеживание
      if (currentVideoId) {
        chrome.runtime.sendMessage({
          action: 'videoStopped'
        });
        currentVideoId = null;
      }
      if (videoCheckInterval) {
        clearInterval(videoCheckInterval);
        videoCheckInterval = null;
      }
    }
  }
}).observe(document, { subtree: true, childList: true });

// Запуск при загрузке страницы
if (window.location.href.includes('/watch')) {
  setTimeout(startVideoTracking, 2000);
}

// Обработка видимости страницы
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    // Страница не активна - приостанавливаем отслеживание
    if (videoCheckInterval) {
      clearInterval(videoCheckInterval);
      videoCheckInterval = null;
    }
    chrome.runtime.sendMessage({
      action: 'videoStopped'
    });
  } else if (window.location.href.includes('/watch')) {
    // Страница снова активна - возобновляем отслеживание
    setTimeout(startVideoTracking, 500);
  }
});