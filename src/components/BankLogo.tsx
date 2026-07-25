import { useState } from 'react';
import type { Bank } from '../data/banks';

/**
 * Логотип банка. Если картинки нет (или банк исчез из реестра СБП) —
 * показываем кружок с первой буквой названия, чтобы вёрстка не «прыгала».
 */
export function BankLogo({ bank, size = 40 }: { bank: Bank; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (!bank.logo || failed) {
    return (
      <div className="bank-logo bank-logo--fallback" style={{ width: size, height: size }}>
        {bank.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      className="bank-logo"
      src={bank.logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
