import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/routes/Home";
import { Projects } from "@/routes/Projects";
import { ProjectDetail } from "@/routes/ProjectDetail";
import { GoalDetail } from "@/routes/GoalDetail";
import { TicketDetail } from "@/routes/TicketDetail";

// ルーティング(design-browser-ui.md §6.2)。:path はencodeURIComponent済みのVaultパス。
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "projects", element: <Projects /> },
      { path: "projects/:path", element: <ProjectDetail /> },
      { path: "goals/:path", element: <GoalDetail /> },
      { path: "tickets/:path", element: <TicketDetail /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
