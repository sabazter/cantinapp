import { MfaSetupClient } from "./mfa-setup-client";

export const metadata = { title: "Configurar MFA — CantinApp" };

export default function MfaPage() {
  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-semibold mb-1">Autenticación en dos pasos</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Protege tu cuenta con un código TOTP generado por tu aplicación de autenticación
        (Google Authenticator, Authy, etc.).
      </p>
      <MfaSetupClient />
    </div>
  );
}
