// Service Worker extension for Android Lock Screen Notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskData = event.notification.data || {};

  if (event.action === 'speak') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          const client = clientList[0];
          client.focus();
          client.postMessage({ type: 'SPEAK_TASK', taskData });
        } else {
          self.clients.openWindow('/?speakTaskId=' + (taskData.taskId || ''));
        }
      })
    );
  } else if (event.action === 'done') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].postMessage({ type: 'COMPLETE_TASK', taskId: taskData.taskId });
        }
      })
    );
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});
