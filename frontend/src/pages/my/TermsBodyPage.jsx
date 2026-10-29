// 담당: 연수
import { Navigate, useParams } from 'react-router-dom';
import { PageHeader } from './common.jsx';
import { MY_ROUTES } from './routes.js';
import { TERMS_DOCS, TERMS_PLACEHOLDER } from './termsContent.js';
import './orders.css';
import './help.css';

export default function TermsBodyPage() {
  const { type } = useParams();
  const doc = TERMS_DOCS[type];
  if (!doc) return <Navigate to={MY_ROUTES.terms} replace />;

  return (
    <main className="ord-page">
      <PageHeader title={doc.name} />
      <div className="hlp-article" style={{ paddingTop: 4 }}>
        <small>시행일 [YYYY.MM.DD]</small>
      </div>
      <div className="hlp-body">
        {TERMS_PLACEHOLDER.map((article) => (
          <section key={article.title} style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{article.title}</h2>
            <p style={{ margin: 0, fontSize: 14 }}>{article.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
