import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const session = await getSession();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bienvenido, {session?.user.nombre}</h1>
        <p className="text-sm text-muted-foreground mt-1">Panel de administración — CantinApp</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Ventas hoy",     value: "—", desc: "Próximamente" },
          { title: "Fiado pendiente",value: "—", desc: "Próximamente" },
          { title: "Stock bajo",     value: "—", desc: "Próximamente" },
          { title: "Alumnos",        value: "—", desc: "Próximamente" },
        ].map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
