import { Alert, Button, Card, Tag, message } from 'antd';
import { useState } from 'react';
import { http } from '@/services/http';

const codeSample = `{
  "model": "qwen3.5-vl",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "请分析这张社区监控截图中的风险" },
        { "type": "image_url", "image_url": { "url": "https://example.com/scene.jpg" } }
      ]
    }
  ],
  "temperature": 0.2,
  "max_tokens": 1024
}`;

const frontendEnv = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '未设置（默认同源）',
  qwenProxyPath: import.meta.env.VITE_QWEN_PROXY_PATH || '/api/qwen/chat/completions',
  qwenModel: import.meta.env.VITE_QWEN_MODEL || 'qwen3.5-vl',
  baiduAk: import.meta.env.VITE_BAIDU_MAP_AK ? '已配置' : '未配置',
  demoStreamUrl: import.meta.env.VITE_DEMO_STREAM_URL || '未配置',
  demoStreamType: import.meta.env.VITE_DEMO_STREAM_TYPE || 'flv'
};

export function ModelCenterPage() {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<Record<string, unknown>>();
  const [api, contextHolder] = message.useMessage();

  const handleHealthCheck = async () => {
    setLoading(true);
    try {
      const response = await http.get('/api/health');
      setHealth(response.data);
      api.success('代理服务已连通');
    } catch (error) {
      api.error(error instanceof Error ? error.message : '代理服务检查失败');
    } finally {
      setLoading(false);
    }
  };

  const healthItems = [
    { label: '服务状态', value: Boolean(health?.ok) ? '可用' : '待检查' },
    { label: '服务名称', value: String(health?.service ?? 'community-risk-warning-proxy') },
    { label: '模型配置', value: String(health?.model ?? frontendEnv.qwenModel) },
    { label: 'Qwen 凭据', value: health ? (Boolean(health.qwenConfigured) ? '已配置' : '未配置') : '待检查' },
    { label: '回包时间', value: String(health?.timestamp ?? '未获取') }
  ];

  const runtimeItems = [
    { label: 'API Base URL', value: frontendEnv.apiBaseUrl },
    { label: 'Qwen 代理路径', value: frontendEnv.qwenProxyPath },
    { label: '默认模型', value: frontendEnv.qwenModel },
    { label: '百度地图 AK', value: frontendEnv.baiduAk },
    { label: '演示流地址', value: frontendEnv.demoStreamUrl },
    { label: '演示流类型', value: frontendEnv.demoStreamType }
  ];

  return (
    <div className="page-shell compact-page-shell">
      {contextHolder}
      <div className="page-topbar">
        <div className="page-title-block">
          <div className="page-kicker">MODEL AND PROXY CENTER</div>
          <div className="page-title-row">
            <h2>模型接入中心</h2>
            <p>以 2x2 固定信息板呈现运行配置、代理状态、请求示例与接入步骤，适配大屏演示场景。</p>
          </div>
        </div>

        <div className="page-actions">
          <Button type="primary" size="small" loading={loading} onClick={handleHealthCheck}>
            检查后端代理状态
          </Button>
        </div>
      </div>

      <div className="model-grid">
        <Card title="前端运行配置" variant="borderless">
          <div className="info-tile-grid">
            {runtimeItems.map((item) => (
              <div key={item.label} className="info-tile">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card title="代理健康状态" variant="borderless">
          <div className="info-tile-grid">
            {healthItems.map((item) => (
              <div key={item.label} className="info-tile">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <Alert
            style={{ marginTop: 12 }}
            type={Boolean(health?.ok) ? 'success' : 'info'}
            showIcon
            message={Boolean(health?.ok) ? '代理服务连通正常' : '尚未执行健康检查'}
            description="前端通过 /api/qwen/chat/completions 访问本地 Node 代理，再由代理转发到 Qwen 接口。"
          />
        </Card>

        <Card title="请求体示例" variant="borderless">
          <div className="card-inline-note">
            前端统一请求 <Tag>/api/qwen/chat/completions</Tag>，由本地代理负责鉴权、超时控制与转发。
          </div>
          <pre className="code-block">{codeSample}</pre>
        </Card>

        <Card title="接入步骤" variant="borderless">
          <div className="step-list">
            <div className="step-item">
              <span>01</span>
              <p>前端复制 <Tag>.env.example</Tag> 为 <Tag>.env</Tag>，配置地图密钥与演示流地址。</p>
            </div>
            <div className="step-item">
              <span>02</span>
              <p>后端复制 <Tag>.env.server.example</Tag> 为 <Tag>.env.server</Tag>，填写 Qwen 代理参数。</p>
            </div>
            <div className="step-item">
              <span>03</span>
              <p>开发时执行 <Tag>npm run dev:all</Tag>，Vite 会将 <Tag>/api</Tag> 请求代理到本地 Node 服务。</p>
            </div>
            <div className="step-item">
              <span>04</span>
              <p>视频流优先接入 HTTP-FLV 或 MPEG-TS，地图 AK 使用百度地图浏览器端密钥。</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
