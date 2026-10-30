import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Analytics } from '@vercel/analytics/react'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* 방문 통계(쿠키 없음). 운영에서는 같은 주소(/_vercel/insights)로만 보낸다. 주소의 ?·# 뒤는 지운다 */}
    <Analytics beforeSend={(e) => ({ ...e, url: e.url.split(/[?#]/)[0] })} />
  </StrictMode>,
)
