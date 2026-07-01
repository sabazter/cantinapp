// Plantillas de email — sin datos financieros en el cuerpo (§9.2)
// Los montos/saldos exactos solo se muestran dentro del portal autenticado.

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://cantinapp.com";

const base = (content: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 8px; max-width: 480px; margin: 0 auto; padding: 32px; }
    .logo { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 24px; }
    .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { margin-top: 24px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    p { color: #374151; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🍽️ CantinApp</div>
    ${content}
    <div class="footer">
      Este mensaje fue generado automáticamente. Por favor no respondas a este correo.
    </div>
  </div>
</body>
</html>`;

export const emailFiadoRegistrado = (alumnoNombre: string) => ({
  subject: `Compra registrada — ${alumnoNombre}`,
  html: base(`
    <p>Se registró una compra a crédito (fiado) para <strong>${alumnoNombre}</strong>.</p>
    <p>Para ver el detalle y el saldo actualizado, ingresa a tu portal.</p>
    <a href="${BASE_URL}/portal" class="btn">Ver mi portal</a>
    <p style="margin-top:16px; font-size:13px; color:#6b7280;">
      Si no reconoces esta compra, comunícate con la cantina de inmediato.
    </p>
  `),
  text: `Se registró una compra a crédito para ${alumnoNombre}. Ingresa a ${BASE_URL}/portal para ver el detalle.`,
});

export const emailAbonoConfirmado = (alumnoNombre: string) => ({
  subject: `Abono confirmado — ${alumnoNombre}`,
  html: base(`
    <p>El pago que reportaste para <strong>${alumnoNombre}</strong> fue <strong>confirmado</strong> por el administrador.</p>
    <p>El saldo actualizado ya está disponible en tu portal.</p>
    <a href="${BASE_URL}/portal" class="btn">Ver mi portal</a>
  `),
  text: `El abono para ${alumnoNombre} fue confirmado. Ingresa a ${BASE_URL}/portal para ver el saldo actualizado.`,
});

export const emailAbonoRechazado = (alumnoNombre: string, motivo: string) => ({
  subject: `Abono no procesado — ${alumnoNombre}`,
  html: base(`
    <p>El pago que reportaste para <strong>${alumnoNombre}</strong> no pudo ser procesado.</p>
    <p><strong>Motivo:</strong> ${motivo}</p>
    <p>Por favor comunícate con la cantina para resolver la situación.</p>
    <a href="${BASE_URL}/portal" class="btn">Ver mi portal</a>
  `),
  text: `El abono para ${alumnoNombre} fue rechazado. Motivo: ${motivo}. Ingresa a ${BASE_URL}/portal.`,
});

export const emailStockBajo = (productos: { nombre: string; stock: number; stockMin: number }[]) => ({
  subject: `⚠️ Alerta: ${productos.length} producto(s) con stock bajo`,
  html: base(`
    <p>Los siguientes productos están por debajo del stock mínimo:</p>
    <ul>
      ${productos.map(p => `<li><strong>${p.nombre}</strong>: ${p.stock} unidades (mínimo: ${p.stockMin})</li>`).join("")}
    </ul>
    <a href="${BASE_URL}/admin/inventario" class="btn">Ir a Inventario</a>
  `),
  text: `Alerta stock bajo: ${productos.map(p => `${p.nombre} (${p.stock}/${p.stockMin})`).join(", ")}`,
});

export const emailResumenDiario = (
  fecha: string,
  totales: { count: number; totalUsd: number },
  cantinaName: string
) => ({
  subject: `Resumen del día ${fecha} — ${cantinaName}`,
  html: base(`
    <p>Resumen de ventas del día <strong>${fecha}</strong> en <strong>${cantinaName}</strong>:</p>
    <ul>
      <li>Total de ventas: <strong>${totales.count}</strong></li>
      <li>Ingreso total: <strong>$${totales.totalUsd.toFixed(2)}</strong></li>
    </ul>
    <a href="${BASE_URL}/admin/reportes" class="btn">Ver reportes completos</a>
  `),
  text: `Resumen ${fecha} — ${totales.count} ventas, total: $${totales.totalUsd.toFixed(2)}`,
});

export const emailCuentaBloqueada = (emailAdmin: string, emailBloqueado: string) => ({
  subject: `🔒 Cuenta bloqueada — ${emailBloqueado}`,
  html: base(`
    <p>La cuenta <strong>${emailBloqueado}</strong> fue bloqueada automáticamente por múltiples intentos fallidos de inicio de sesión.</p>
    <p>Si fue un intento no autorizado, te recomendamos revisar los registros de auditoría.</p>
    <a href="${BASE_URL}/admin/configuracion" class="btn">Ir a Configuración</a>
  `),
  text: `Cuenta bloqueada: ${emailBloqueado}. Revisa los logs de auditoría.`,
  to: emailAdmin,
});

export const emailResetPassword = (token: string) => ({
  subject: "Restablecer contraseña — CantinApp",
  html: base(`
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
    <p>Este enlace es válido por <strong>15 minutos</strong> y solo puede usarse una vez.</p>
    <a href="${BASE_URL}/recuperar-password/nueva?token=${token}" class="btn">Restablecer contraseña</a>
    <p style="margin-top:16px; font-size:13px; color:#6b7280;">
      Si no solicitaste este cambio, puedes ignorar este mensaje.
    </p>
  `),
  text: `Para restablecer tu contraseña visita: ${BASE_URL}/recuperar-password/nueva?token=${token}`,
});

export const emailVerificacion = (token: string) => ({
  subject: "Verifica tu correo — CantinApp",
  html: base(`
    <p>Haz clic en el botón para verificar tu dirección de correo electrónico.</p>
    <p>Este enlace es válido por <strong>24 horas</strong>.</p>
    <a href="${BASE_URL}/verificar-email?token=${token}" class="btn">Verificar mi correo</a>
    <p style="margin-top:16px; font-size:13px; color:#6b7280;">
      Si no creaste una cuenta en CantinApp, puedes ignorar este mensaje.
    </p>
  `),
  text: `Verifica tu correo visitando: ${BASE_URL}/verificar-email?token=${token}`,
});

export const emailBienvenidaRepresentante = (nombre: string, verToken: string) => ({
  subject: "Bienvenido a CantinApp — Verifica tu correo",
  html: base(`
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu cuenta de representante ha sido creada exitosamente. Ya puedes acceder al portal
    para consultar el saldo y el historial de compras de tus hijos.</p>
    <p>Por favor verifica tu dirección de correo haciendo clic en el botón:</p>
    <a href="${BASE_URL}/verificar-email?token=${verToken}" class="btn">Verificar mi correo</a>
    <p style="margin-top:16px; font-size:13px; color:#6b7280;">
      Este enlace es válido por 24 horas.
    </p>
  `),
  text: `Hola ${nombre}, verifica tu correo: ${BASE_URL}/verificar-email?token=${verToken}`,
});

export const emailNuevoRegistroAdmin = (repNombre: string, repEmail: string, alumnoNombre: string, cantinaId: string) => ({
  subject: "Nuevo representante registrado — CantinApp",
  html: base(`
    <p>Se ha registrado un nuevo representante en la cantina:</p>
    <ul style="color:#374151; font-size:14px; line-height:2;">
      <li><strong>Nombre:</strong> ${repNombre}</li>
      <li><strong>Email:</strong> ${repEmail}</li>
      <li><strong>Alumno:</strong> ${alumnoNombre}</li>
    </ul>
    <p>Recuerda habilitar el fiado para el alumno si corresponde desde el panel.</p>
    <a href="${BASE_URL}/admin/alumnos" class="btn">Ver alumnos</a>
  `),
  text: `Nuevo representante: ${repNombre} (${repEmail}) — Alumno: ${alumnoNombre}`,
});

export const emailBienvenidaProfesor = (nombre: string, verToken: string) => ({
  subject: "Bienvenido a CantinApp — Verifica tu correo",
  html: base(`
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu cuenta de profesor ha sido registrada exitosamente. Para completar tu registro, por favor verifica tu dirección de correo haciendo clic en el botón:</p>
    <a href="${BASE_URL}/verificar-email?token=${verToken}" class="btn">Verificar mi correo</a>
    <p style="margin-top:16px; font-size:13px; color:#6b7280;">
      Una vez verificado, tu cuenta pasará a revisión. El administrador la activará para que puedas iniciar sesión.
    </p>
  `),
  text: `Hola ${nombre}, verifica tu correo: ${BASE_URL}/verificar-email?token=${verToken}`,
});

export const emailNuevoRegistroProfesorAdmin = (profNombre: string, profEmail: string, cantinaId: string) => ({
  subject: "Nuevo registro de profesor pendiente — CantinApp",
  html: base(`
    <p>Se ha registrado un nuevo profesor en la cantina y está pendiente de activación:</p>
    <ul style="color:#374151; font-size:14px; line-height:2;">
      <li><strong>Nombre:</strong> ${profNombre}</li>
      <li><strong>Email:</strong> ${profEmail}</li>
    </ul>
    <p>Por favor, revisa y activa su cuenta desde el panel de usuarios para que pueda acceder.</p>
    <a href="${BASE_URL}/admin/usuarios" class="btn">Ver usuarios</a>
  `),
  text: `Nuevo profesor registrado: ${profNombre} (${profEmail}) — Pendiente de activación`,
});

export const emailSolicitudEliminacion = (nombre: string, email: string) => ({
  subject: "Solicitud de eliminación de datos — CantinApp",
  html: base(`
    <p>El representante <strong>${nombre}</strong> (${email}) ha solicitado la eliminación de su cuenta y sus datos personales.</p>
    <p>Por favor gestiona esta solicitud desde el panel de administración.</p>
    <p style="margin-top:16px; font-size:13px; color:#6b7280;">
      Según las políticas de privacidad, esta solicitud debe procesarse en un plazo de 30 días.
    </p>
  `),
  text: `El representante ${nombre} (${email}) solicita eliminación de sus datos.`,
});
