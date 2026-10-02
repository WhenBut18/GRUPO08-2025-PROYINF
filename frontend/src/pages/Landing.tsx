import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, FileCheck, Shield, Clock, TrendingUp, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Landing() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const features = [
    {
      icon: Calculator,
      title: "Simulación Instantánea",
      description: "Calcula tu préstamo en segundos sin compromiso",
    },
    {
      icon: FileCheck,
      title: "Solicitud 100% Digital",
      description: "Completa tu solicitud desde cualquier lugar",
    },
    {
      icon: Shield,
      title: "Proceso Seguro",
      description: "Tus datos están protegidos con encriptación avanzada",
    },
    {
      icon: Clock,
      title: "Aprobación Rápida",
      description: "Respuesta en menos de 24 horas hábiles",
    },
    {
      icon: TrendingUp,
      title: "Tasas Competitivas",
      description: "Tasas de interés adaptadas a tus necesidades",
    },
    {
      icon: UserCheck,
      title: "Sin Requisitos Complejos",
      description: "Proceso simple y transparente",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Préstamos Rápidos" className="h-8 md:h-10 w-auto object-contain" />
          </div>
          
          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <Button variant="ghost" onClick={() => navigate("/profile")}>
                  Mi Perfil
                </Button>
                <Button variant="ghost" onClick={() => navigate("/applications")}>
                  Mis Solicitudes
                </Button>
                <Button variant="ghost" onClick={() => navigate("/pay-loans")}>
                  Pagar Préstamos
                </Button>
                <Button variant="outline" onClick={signOut}>
                  Cerrar Sesión
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/auth")}>
                Iniciar Sesión
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Tu préstamo al alcance de un clic
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Simula, solicita y obtén tu préstamo de forma 100% digital. 
            Proceso rápido, seguro y transparente.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="text-lg h-14"
              onClick={() => navigate("/simulator")}
            >
              <Calculator className="w-5 h-5 mr-2" />
              Simular Préstamo
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
          <Card className="text-center shadow-card">
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-primary">5-15%</CardTitle>
              <CardDescription>Tasa Variable</CardDescription>
            </CardHeader>
          </Card>
          <Card className="text-center shadow-card">
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-primary">3-60</CardTitle>
              <CardDescription>Meses de plazo</CardDescription>
            </CardHeader>
          </Card>
          <Card className="text-center shadow-card">
            <CardHeader>
              <CardTitle className="text-4xl font-bold text-primary">$5M</CardTitle>
              <CardDescription>Monto máximo</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
      {/*   
      <section className="bg-card/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            ¿Por qué elegirnos?
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="shadow-card">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="max-w-2xl mx-auto bg-gradient-primary text-primary-foreground shadow-elevated">
          <CardContent className="py-12">
            <h2 className="text-3xl font-bold mb-4">
              ¿Listo para comenzar?
            </h2>
            <p className="text-lg mb-6 opacity-90">
              Simula tu préstamo ahora y descubre cuánto puedes obtener
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="text-lg h-14"
              onClick={() => navigate("/simulator")}
            >
              Simular Mi Préstamo
            </Button>
          </CardContent>
        </Card>
      </section>
      */}

      {/* Footer 
      <footer className="border-t bg-card/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        </div>
      </footer>
      */}
    </div>
  );
}
