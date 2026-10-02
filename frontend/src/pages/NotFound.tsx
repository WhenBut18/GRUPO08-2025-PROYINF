import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Home, Search } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-elevated">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="text-9xl font-bold text-primary/20">404</div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Search className="w-16 h-16 text-primary/40" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl md:text-4xl mb-2">
            Página no encontrada
          </CardTitle>
          <CardDescription className="text-lg">
            Lo sentimos, la página que buscas no existe o ha sido movida.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-muted-foreground">
            <p className="mb-4">
              Puede que la URL esté incorrecta o que la página haya sido eliminada.
            </p>
            <p>
              ¿Qué puedes hacer?
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
              size="lg"
            >
              <Home className="w-4 h-4" />
              Ir al inicio
            </Button>
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="flex items-center gap-2"
              size="lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver atrás
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t">
            <p className="text-sm text-center text-muted-foreground mb-3">
              Páginas disponibles:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/simulator")}
              >
                Simulador
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/applications")}
              >
                Solicitudes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/pay-loans")}
              >
                Pagar Préstamos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/profile")}
              >
                Perfil
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

