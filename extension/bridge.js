export const sendToPage = async ({ message, expectedOrigin }) =>
  new Promise((resolve, reject) => {
    if (location.origin !== expectedOrigin) {
      reject(Error('DTab 标签页已跳转，请重新连接'));
      return;
    }
    const timeout = setTimeout(() => {
      window.removeEventListener('dtab:extension-response', listener);
      reject(Error('DTab 页面尚未就绪，请刷新该页面后重试'));
    }, 5000);
    function listener(event) {
      let response;
      try {
        response = JSON.parse(event.detail);
      } catch {
        return;
      }
      if (response.id !== message.id) return;
      clearTimeout(timeout);
      window.removeEventListener('dtab:extension-response', listener);
      resolve(response);
    }
    window.addEventListener('dtab:extension-response', listener);
    window.dispatchEvent(
      new CustomEvent('dtab:extension-request', { detail: JSON.stringify(message) }),
    );
  });
