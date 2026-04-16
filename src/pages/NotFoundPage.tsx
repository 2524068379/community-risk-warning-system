import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="not-found-page">
      <Result
        status="404"
        title="页面不存在"
        subTitle="请返回系统首页继续操作。"
        extra={
          <Button type="primary">
            <Link to="/overview">返回首页</Link>
          </Button>
        }
      />
    </div>
  );
}
