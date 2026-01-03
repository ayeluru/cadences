import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { SiReplit } from "react-icons/si";

export default function AuthPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-display font-bold text-foreground">Cadences</h1>
          <p className="text-lg text-muted-foreground">Track recurring tasks and build better habits.</p>
        </div>

        <Card className="border-2 border-primary/10 shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in with your Replit account to get started.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {[
                "Track recurring tasks effortlessly",
                "Get reminders when things are due",
                "Visualize your completion habits",
                "Organize with categories and tags"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  {feature}
                </div>
              ))}
            </div>

            <Button onClick={handleLogin} className="w-full text-lg py-6 shadow-lg shadow-primary/25" size="lg" data-testid="button-login">
              <SiReplit className="mr-2 h-5 w-5" />
              Continue with Replit
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              New users will have an account created automatically
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
