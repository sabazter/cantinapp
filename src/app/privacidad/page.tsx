import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad — CantinApp",
};

export default function PrivacidadPage() {
  const fecha = "19 de mayo de 2026";

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/login" className="text-sm text-primary hover:underline">
            ← Volver
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Política de Privacidad</h1>
          <p className="text-sm text-gray-500 mt-1">Última actualización: {fecha}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-8 space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Responsable del tratamiento</h2>
            <p>
              CantinApp es un sistema de gestión para cantinas escolares. El responsable del
              tratamiento de los datos personales es la institución educativa que administra
              la cantina donde el usuario tiene una cuenta activa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Datos que recopilamos</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li><strong>Representantes:</strong> nombre completo, correo electrónico, número de teléfono.</li>
              <li><strong>Alumnos:</strong> nombre completo, curso, sección, número de cédula (almacenado cifrado con AES-256-GCM), fotografía (opcional).</li>
              <li><strong>Transacciones:</strong> historial de compras, pagos y abonos asociados a cada alumno.</li>
              <li><strong>Datos técnicos:</strong> dirección IP, agente de usuario, registros de auditoría de acceso.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Finalidad del tratamiento</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Gestionar las cuentas de los alumnos y el control de fiado en la cantina.</li>
              <li>Notificar al representante sobre movimientos de la cuenta de su hijo.</li>
              <li>Generar reportes operativos para el personal de la institución.</li>
              <li>Garantizar la seguridad de la plataforma (registro de auditoría).</li>
            </ul>
            <p className="mt-3 text-sm">
              Los datos de comportamiento de consumo utilizados en el módulo CRM se emplean
              exclusivamente para la operación interna de la cantina y <strong>no se comparten
              con terceros ni se usan con fines publicitarios</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Datos de menores de edad</h2>
            <p className="text-sm">
              CantinApp maneja datos de menores de edad bajo la responsabilidad de la institución
              educativa y con el consentimiento explícito del representante legal, registrado con
              fecha, hora e IP al momento de la inscripción del alumno.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm mt-3">
              <li>La fotografía del alumno es <strong>opcional</strong> y nunca obligatoria.</li>
              <li>Al dar de baja a un alumno, su fotografía es eliminada del almacenamiento.</li>
              <li>Las cédulas se almacenan cifradas y nunca se exponen en texto plano.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Seguridad de los datos</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Contraseñas cifradas con bcrypt (costo 12).</li>
              <li>Datos sensibles (cédulas, referencias bancarias) cifrados con AES-256-GCM.</li>
              <li>Comunicaciones protegidas con TLS/HTTPS.</li>
              <li>Acceso restringido por roles; cada usuario solo ve los datos que le corresponden.</li>
              <li>Registro de auditoría inmutable para todas las operaciones financieras.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Derechos del usuario</h2>
            <p className="text-sm">
              Los representantes tienen derecho a:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm mt-2">
              <li><strong>Acceso:</strong> consultar los datos de sus hijos y su historial desde el portal.</li>
              <li><strong>Rectificación:</strong> solicitar la corrección de datos incorrectos al administrador.</li>
              <li><strong>Opt-out de notificaciones:</strong> desactivar los avisos por email y WhatsApp desde la sección Configuración del portal.</li>
              <li><strong>Eliminación:</strong> solicitar la eliminación de su cuenta y datos personales desde la sección Configuración del portal. La solicitud se procesa en un plazo máximo de 30 días.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Conservación de datos</h2>
            <p className="text-sm">
              Los datos se conservan mientras la cuenta esté activa. Los registros financieros
              se conservan durante el período requerido por la normativa local aplicable.
              Al eliminarse una cuenta, los datos personales identificables se eliminan o
              anonimizan, conservando únicamente los registros financieros históricos de forma
              anonimizada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Contacto</h2>
            <p className="text-sm">
              Para ejercer cualquiera de los derechos descritos o realizar consultas sobre
              el tratamiento de sus datos, puede comunicarse directamente con el administrador
              de la cantina de su institución educativa a través del portal o de los medios
              de contacto habituales de la institución.
            </p>
          </section>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          CantinApp · Sistema de gestión para cantinas escolares
        </p>
      </div>
    </main>
  );
}
