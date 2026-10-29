// 담당: 연수
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../my/common.jsx';
import { CheckIcon } from '../my/icons.jsx';
import './auth.css';

export function AuthHeader({ title, step }) {
  const navigate = useNavigate();
  return (
    <header className="lg-header">
      <button
        type="button"
        className="lg-header__back"
        aria-label="뒤로"
        onClick={() => navigate(-1)}
      >
        <BackIcon />
      </button>
      <h1 className="lg-header__title">{title}</h1>
      {step ? (
        <span className="lg-header__step">
          <b>{step}</b> / 2
        </span>
      ) : null}
    </header>
  );
}

export function Box({ checked, disabled = false, onChange, label }) {
  return (
    <label className={`lg-box${checked ? ' is-on' : ''}${disabled ? ' is-off' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span className="lg-box__mark">
        {checked ? <CheckIcon width={14} height={14} strokeWidth={3} /> : null}
      </span>
    </label>
  );
}
