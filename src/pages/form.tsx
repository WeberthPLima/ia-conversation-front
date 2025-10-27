'use client';
import classNames from 'classnames';
import styles from '~/lib/form/styles.module.css';

export default function Form() {
  return (
    <div className={styles.Container}>
      <div
        className={classNames(styles.SuccessImage, {
          [styles.SuccessImageHidden]: !submitted,
        })}
      />
      <div
        className={classNames(styles.TopLogo, {
          [styles.LogosHidden]: submitted,
        })}
      />
      <form
        className={classNames(styles.Form, {
          [styles.FormHidden]: submitted,
        })}
        onSubmit={onSubmit}>
        <h1>
          Preencha o formulário abaixo para iniciar a experiência com a Árvore
          BB.
        </h1>
        <div className={styles.Inputs}>
          <input
            ref={cpfRef}
            type="text"
            placeholder="CPF"
            autoComplete="off"
            inputMode="numeric"
            onChange={e => applyCPFMask(e.target.value)}
            maxLength={14}
          />
          <input
            ref={nameRef}
            type="text"
            placeholder="Nome Completo"
            required
            autoComplete="off"
            autoCapitalize="words"
          />
          <input
            ref={emailRef}
            type="email"
            placeholder="E-mail"
            required
            autoComplete="off"
            inputMode="email"
            autoCapitalize="off"
            onChange={e => formatEmail(e.target.value)}
          />
          <input
            ref={phoneRef}
            type="text"
            placeholder="Telefone (whatsapp)"
            required
            inputMode="tel"
            autoComplete="off"
            onChange={e => applyPhoneMask(e.target.value)}
            maxLength={15}
          />
          <input
            ref={birthDateRef}
            placeholder="Data de nascimento"
            required
            autoComplete="off"
            inputMode="numeric"
            autoCapitalize="off"
            onChange={e => formatBirthDate(e.target.value)}
            maxLength={10}
          />
          <input
            ref={areaRef}
            placeholder="Área de atuação"
            required
            autoComplete="off"
            autoCapitalize="off"
          />
          <div className={styles.SelectWrapper}>
            <select ref={languageRef} defaultValue="" required>
              <option value="" hidden disabled>
                Selecione o Idioma
              </option>
              <option value="ptbr">Português</option>
              <option value="en">Inglês</option>
              <option value="es">Espanhol</option>
            </select>
          </div>
        </div>
        <div className={styles.Terms}>
          <input id="terms" type="checkbox" required />
          <label htmlFor="terms">
            Autorizo o uso da minha imagem para fins institucionais e concordo
            com a utilização dos meus dados para receber informativos, campanhas
            de marketing e outras comunicações
          </label>
        </div>
        {formError && <span className={styles.Error}>{formError}</span>}
        <button type="submit" className={styles.Button} disabled={isSubmitting}>
          Finalizar cadastro
        </button>
      </form>
      <div
        className={classNames(styles.BottomLogo, {
          [styles.LogosHidden]: submitted,
        })}
      />
    </div>
  );
}
