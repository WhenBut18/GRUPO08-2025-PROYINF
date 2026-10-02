import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Calculator, TrendingUp, Clock, DollarSign, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

    interface LoanCalculation {
      monthlyPayment: number;
      totalPayment: number;
      totalInterest: number;
      interestRate: number;
    }

    const DEFAULT_ANNUAL_INTEREST_RATE = 12;
    const MIN_AMOUNT = 100000;
    const MAX_AMOUNT = 5000000;
    const MIN_MONTHS = 3;
    const MAX_MONTHS = 60;

    export default function Simulator() {
      const navigate = useNavigate();
      const { user } = useAuth();
      const { toast } = useToast();
      const [amount, setAmount] = useState<number>(1000000);
      const [months, setMonths] = useState<number>(12);
      const [calculation, setCalculation] = useState<LoanCalculation | null>(null);
      const [interestRate, setInterestRate] = useState<number>(DEFAULT_ANNUAL_INTEREST_RATE);
      const [saving, setSaving] = useState(false);

      const calculateLoanWithRate = (loanAmount: number, loanMonths: number, annualRate: number): LoanCalculation => {
        const monthlyRate = annualRate / 100 / 12;
        const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanMonths)) /
                              (Math.pow(1 + monthlyRate, loanMonths) - 1);
        const totalPayment = monthlyPayment * loanMonths;
        const totalInterest = totalPayment - loanAmount;

        return {
          monthlyPayment,
          totalPayment,
          totalInterest,
          interestRate: annualRate,
        };
      };

      // Regla local actualizada: rango de tasas 5% - 15% (mapeo por monto + ajuste por plazo)
      const getVariableRate = (loanAmount: number, loanMonths: number) => {
        let baseRate: number;
        if (loanAmount <= 500000) baseRate = 15.0;
        else if (loanAmount <= 1000000) baseRate = 13.0;
        else if (loanAmount <= 2000000) baseRate = 11.0;
        else if (loanAmount <= 5000000) baseRate = 9.0;
        else baseRate = 7.0;

        let termAdj = 0.0;
        if (loanMonths <= 6) termAdj = -1.0;
        else if (loanMonths <= 12) termAdj = 0.0;
        else if (loanMonths <= 24) termAdj = 0.5;
        else if (loanMonths <= 60) termAdj = 1.0;
        else termAdj = 1.5;

        let annualRate = baseRate + termAdj;
        if (annualRate < 5.0) annualRate = 5.0;
        if (annualRate > 15.0) annualRate = 15.0;
        return { annualRate: Number(annualRate.toFixed(2)), baseRate, termAdj };
      };

      useEffect(() => {
        const rateInfo = getVariableRate(amount, months);
        setInterestRate(rateInfo.annualRate);
        const result = calculateLoanWithRate(amount, months, rateInfo.annualRate);
        setCalculation(result);
      }, [amount, months]);

      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          minimumFractionDigits: 0,
        }).format(value);
      };

      const handleAmountChange = (value: string) => {
        const numValue = parseInt(value.replace(/\D/g, '')) || 0;
        setAmount(Math.min(Math.max(numValue, MIN_AMOUNT), MAX_AMOUNT));
      };

      const handleMonthsChange = (value: number[]) => {
        setMonths(value[0]);
      };

      const handleApply = async () => {
        if (!calculation) return;

        if (!user) {
          toast({
            title: "Inicia sesión",
            description: "Debes iniciar sesión para solicitar un préstamo",
          });
          navigate("/auth");
          return;
        }

        // Save simulation via API TRAMITACION
        setSaving(true);
        try {
          const API_TRAMITACION_URL = "http://localhost:8080";
          
          // Create simulation
          const createResponse = await fetch(`${API_TRAMITACION_URL}/loan_simulations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: user.id,
              amount,
              months,
              interest_rate: interestRate,
              monthly_payment: calculation.monthlyPayment,
              total_payment: calculation.totalPayment,
              total_interest: calculation.totalInterest,
            }),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.message || "No se pudo guardar la simulación");
          }

          // Since the API doesn't return the ID, fetch the most recent simulation for this user
          const getResponse = await fetch(`${API_TRAMITACION_URL}/loan_simulations?user_id=${user.id}`);
          if (!getResponse.ok) {
            throw new Error("No se pudo obtener la simulación creada");
          }

          const simulations = await getResponse.json();
          const simulationData = simulations && simulations.length > 0 ? simulations[0] : null;

          if (!simulationData) {
            throw new Error("No se pudo obtener la simulación creada");
          }

          // Navigate to apply page with simulation data
          navigate(`/apply?simulation=${simulationData.id}`);
        } catch (error: any) {
          console.error("Error saving simulation:", error);
          toast({
            title: "Error",
            description: error.message || "No se pudo guardar la simulación",
            variant: "destructive",
          });
        } finally {
          setSaving(false);
        }
      };

      return (
        <div className="min-h-screen bg-gradient-hero">
          <div className="container mx-auto px-4 py-12 max-w-6xl">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>

            <header className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
                <Calculator className="w-4 h-4" />
                <span className="text-sm font-medium">Simulador de Préstamos</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Calcula tu préstamo en segundos
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Descubre cuánto pagarías mensualmente y planifica tu financiamiento de forma transparente
              </p>
            </header>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Input Section */}
              <Card className="shadow-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Datos del préstamo
                  </CardTitle>
                  <CardDescription>
                    Ajusta el monto y plazo según tus necesidades
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="amount" className="text-base font-medium">
                      Monto del préstamo
                    </Label>
                    <Input
                      id="amount"
                      type="text"
                      value={formatCurrency(amount)}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      className="text-2xl font-bold h-14"
                    />
                    <Slider
                      value={[amount]}
                      onValueChange={(value) => setAmount(value[0])}
                      min={MIN_AMOUNT}
                      max={MAX_AMOUNT}
                      step={50000}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(MIN_AMOUNT)}</span>
                      <span>{formatCurrency(MAX_AMOUNT)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="months" className="text-base font-medium flex items-center justify-between">
                      <span>Plazo</span>
                      <span className="text-primary text-xl font-bold">{months} meses</span>
                    </Label>
                    <Slider
                      id="months"
                      value={[months]}
                      onValueChange={handleMonthsChange}
                      min={MIN_MONTHS}
                      max={MAX_MONTHS}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{MIN_MONTHS} meses</span>
                      <span>{MAX_MONTHS} meses</span>
                    </div>
                  </div>

                  <div className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tasa de interés anual</span>
                      <span className="text-lg font-bold text-primary">{interestRate}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results Section */}
              <div className="space-y-6">
                <Card className="shadow-elevated bg-gradient-primary text-primary-foreground">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Cuota mensual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl md:text-5xl font-bold">
                      {calculation ? formatCurrency(calculation.monthlyPayment) : '-'}
                    </p>
                    <p className="text-sm mt-2 opacity-90">
                      Pago fijo durante {months} meses
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-accent" />
                      Resumen del préstamo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Monto solicitado</span>
                      <span className="font-bold text-lg">{formatCurrency(amount)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Total de intereses</span>
                      <span className="font-bold text-lg text-warning">
                        {calculation ? formatCurrency(calculation.totalInterest) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-muted-foreground">Total a pagar</span>
                      <span className="font-bold text-xl text-foreground">
                        {calculation ? formatCurrency(calculation.totalPayment) : '-'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  size="lg" 
                  className="w-full h-14 text-lg font-semibold shadow-elevated"
                  onClick={handleApply}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Solicitar este préstamo"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }