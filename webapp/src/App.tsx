import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/routes/Home";
import { Projects } from "@/routes/Projects";
import { ProjectDetail } from "@/routes/ProjectDetail";
import { Tickets } from "@/routes/Tickets";
import { TicketDetail } from "@/routes/TicketDetail";
import { Todos } from "@/routes/Todos";

// ルーティング(design-browser-ui.md §6.2)。:path はencodeURIComponent済みのVaultパス。
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "projects", element: <Projects /> },
      { path: "projects/:path", element: <ProjectDetail /> },
      { path: "tickets", element: <Tickets /> },
      { path: "tickets/:path", element: <TicketDetail /> },
      { path: "todos", element: <Todos /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
