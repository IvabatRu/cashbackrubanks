import { CloseIcon, SearchIcon } from './icons';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}

export function SearchInput({ value, onChange, placeholder, autoFocus }: SearchInputProps) {
  return (
    <div className="search">
      <SearchIcon className="search-icon" />
      <input
        className="search-input"
        type="search"
        inputMode="search"
        value={value}
        placeholder={placeholder}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- в панели поиска фокус сразу в поле это ожидаемо
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="icon-button search-clear"
          onClick={() => onChange('')}
          aria-label="Очистить"
        >
          <CloseIcon width={16} height={16} />
        </button>
      )}
    </div>
  );
}
