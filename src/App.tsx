import OpenAI from "openai";
import { useState, useEffect } from "react";
import { produce } from "immer";
import { Popover } from "react-tiny-popover";
import { useLocalStorage } from "usehooks-ts";

const oai = new OpenAI({
  dangerouslyAllowBrowser: true,
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  baseURL: import.meta.env.VITE_OPENAI_API_BASE_URL,
});

const makeId = () => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < 5; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const colors = [
  "#FF6B6B", // Coral Red
  "#4ECDC4", // Turquoise
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage Green
  "#FFEEAD", // Cream Yellow
  "#D4A5A5", // Dusty Rose
  "#9B786F", // Mocha
  "#A8E6CF", // Mint
  "#FFD3B6", // Peach
  "#FF8B94", // Salmon Pink
  "#B39CD0", // Lavender
  "#98DDCA", // Aqua
  "#F6D7A7", // Sand
  "#E7BCDE", // Light Pink
  "#87A8D0", // Powder Blue
];
const popLength = 4;
const max_generations = 3;

const getUnusedColor = (usedColors: string[]) => {
  const availableColors = colors.filter((color) => !usedColors.includes(color));
  if (availableColors.length === 0) return colors[0]; // fallback
  return availableColors[Math.floor(Math.random() * availableColors.length)];
};

interface Data {
  population: number;
  generations: {
    population: {
      id: string;
      score: number;
      prompt: string;
      color?: string;
      parentIds?: string[];
      image?: string;
    }[];
  }[];
}

interface Project {
  id: string;
  title: string; // Add title field for projects
  data: Data;
  createdAt: number;
  updatedAt: number;
}

type AppMode = "prompt" | "image" | "p5";

const model = "google/gemini-2.0-flash-001";

// Function to generate a unique project ID
const generateProjectId = () => {
  return makeId() + "-" + Date.now().toString(36);
};

function App() {
  // Store all projects in localStorage
  const [projects, setProjects] = useLocalStorage<Record<string, Project>>(
    "evolve-projects",
    {}
  );

  // Store current project ID
  const [currentProjectId, setCurrentProjectId] = useState<string>("");

  // Add state for projects drawer
  const [showProjectsDrawer, setShowProjectsDrawer] = useState(false);

  // Data state now initialized from localStorage based on projectId
  const [data, setData] = useState<Data>({
    population: popLength,
    generations: [
      {
        population: [
          {
            prompt: "A cute cat",
            score: 0.5,
            id: makeId(),
          },
        ],
      },
    ],
  });

  // Persist mode in localStorage
  const [mode, setMode] = useLocalStorage<AppMode>("evolve-mode", "prompt");
  const [loading, setLoading] = useState(false);
  const [imageGenerating, setImageGenerating] = useState<
    Record<string, boolean>
  >({});
  const [popoverOpen, setPopoverOpen] = useState<Record<string, boolean>>({});

  // Add setting for showing full previews
  const [showFullPreviews, setShowFullPreviews] = useLocalStorage<boolean>(
    "evolve-show-full-previews",
    false
  );

  // Add a state for tracking batch image generation progress
  const [generatingAllImages, setGeneratingAllImages] = useState<{
    active: boolean;
    total: number;
    completed: number;
  }>({ active: false, total: 0, completed: 0 });

  // Initialize project from URL or create new one
  useEffect(() => {
    // Get project ID from URL if it exists
    const urlParams = new URLSearchParams(window.location.search);
    let projectId = urlParams.get("id");

    // If no project ID in URL or it doesn't exist in storage, create a new one
    if (!projectId || !projects[projectId]) {
      projectId = generateProjectId();
      const seedPrompt = data.generations[0].population[0].prompt;

      // Create a new project
      const newProject: Project = {
        id: projectId,
        title: seedPrompt, // Use seed prompt as title
        data: data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add to projects
      setProjects({
        ...projects,
        [projectId]: newProject,
      });

      // Update URL without refreshing page
      window.history.pushState({}, "", `?id=${projectId}`);
    } else {
      // Load existing project data
      setData(projects[projectId].data);
    }

    setCurrentProjectId(projectId);
  }, []);

  // Save data changes to localStorage whenever data changes
  useEffect(() => {
    if (currentProjectId) {
      setProjects(
        produce((draft) => {
          if (!draft[currentProjectId]) {
            draft[currentProjectId] = {
              id: currentProjectId,
              title: data.generations[0].population[0].prompt, // Use seed prompt as title
              data: data,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
          } else {
            // Update title if seed prompt changes
            draft[currentProjectId].title =
              data.generations[0].population[0].prompt;
            draft[currentProjectId].data = data;
            draft[currentProjectId].updatedAt = Date.now();
          }
        })
      );
    }
  }, [data, currentProjectId]);

  const generateImage = async (
    prompt: string,
    genIndex: number,
    popId: string
  ) => {
    // Skip if already has image or is currently generating
    if (imageGenerating[popId]) {
      return;
    }

    // Find the population item by ID instead of using direct array indices
    const populationItem = data.generations[genIndex].population.find(
      (item) => item.id === popId
    );

    if (!populationItem || populationItem.image) {
      return;
    }

    // Set loading state for this specific population item
    setImageGenerating((prev) => ({ ...prev, [popId]: true }));

    try {
      // Use fetch to call our proxy server endpoint instead of direct Replicate API
      const response = await fetch("http://localhost:3001/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();

      // Update the data with generated image URL by finding the item by ID
      if (data.imageUrl) {
        setData(
          produce((draft) => {
            const popIndex = draft.generations[genIndex].population.findIndex(
              (item) => item.id === popId
            );

            if (popIndex !== -1) {
              draft.generations[genIndex].population[popIndex].image =
                data.imageUrl;
            }
          })
        );

        // Open popover when image is ready
        setPopoverOpen((prev) => ({
          ...prev,
          [popId]: true,
        }));
      }
    } catch (error) {
      console.error("Failed to generate image:", error);
    } finally {
      // Clear loading state
      setImageGenerating((prev) => {
        const newState = { ...prev };
        delete newState[popId];
        return newState;
      });
    }
  };

  const go = async () => {
    setLoading(true);
    try {
      // Create a local copy of generations to work with
      const currentGenerations = JSON.parse(
        JSON.stringify(data.generations)
      ) as Data["generations"];

      for (let i = 0; i < max_generations; i++) {
        // Tournament selection for parents
        const selectParent = () => {
          const tournamentSize = 3;
          const tournament = Array.from(
            { length: tournamentSize },
            () =>
              currentGenerations[currentGenerations.length - 1].population[
                Math.floor(
                  Math.random() *
                    currentGenerations[currentGenerations.length - 1].population
                      .length
                )
              ]
          );
          return tournament.reduce((best, current) =>
            current.score > best.score ? current : best
          );
        };

        const prompt =
          currentGenerations.length === 1
            ? currentGenerations[0].population[0].prompt
            : (() => {
                const parent1 = selectParent();
                let parent2;
                do {
                  parent2 = selectParent();
                } while (parent2.prompt === parent1.prompt);
                return `${parent1.prompt} + ${parent2.prompt}`;
              })();

        // If this is the first generation, use a single request to generate all variations
        if (currentGenerations.length === 1) {
          const completion = await oai.chat.completions.create({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are a creative prompt generator. Output only valid JSON array with objects containing 'prompt' fields. Generate creative variations of the given prompt.",
              },
              {
                role: "user",
                content: `Generate ${data.population} creative variations of this seed prompt: "${prompt}". Return as JSON array with format [{prompt: string}].`,
              },
            ],
            temperature: 0.4,
          });

          let content = completion.choices[0].message.content ?? "";
          content = content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();

          const parsedContent = JSON.parse(content);
          const newPopulation = parsedContent.map(
            (item: any, index: number) => ({
              ...item,
              id: makeId(),
              score: 0, // Initialize with zero score
              color: getUnusedColor(
                index > 0
                  ? parsedContent.slice(0, index).map((p: any) => p.color)
                  : []
              ),
            })
          );

          // Score the generated prompts at the end of generation
          const scoredPopulation = await scorePrompts(newPopulation, prompt);

          // Update local generations
          currentGenerations.push({
            population: scoredPopulation,
          });
        } else {
          // For subsequent generations, select parent pairs first and make individual requests
          const parentPairs = [];

          // Create parent pairs for the desired population size
          for (let j = 0; j < data.population; j++) {
            // Select first parent
            const parent1 = selectParent();

            // Select second parent (different from the first)
            let parent2;
            do {
              parent2 = selectParent();
            } while (parent2.id === parent1.id);

            parentPairs.push({ parent1, parent2 });
          }

          // Collect all the new children
          const newPopulation: any[] = [];

          // Make individual requests for each parent pair
          for (let j = 0; j < parentPairs.length; j++) {
            const { parent1, parent2 } = parentPairs[j];
            const parentPrompt = `${parent1.prompt} + ${parent2.prompt}`;

            const completion = await oai.chat.completions.create({
              model,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a creative prompt generator. Output only valid JSON containing a single object with a 'prompt' field. When combining prompts, create meaningful crossovers that preserve the best elements of both parent prompts.",
                },
                {
                  role: "user",
                  content: `Create a new prompt by combining elements from these parent prompts: "${parentPrompt}". Perform creative crossover while maintaining coherence. Return as JSON with format {prompt: string}.`,
                },
              ],
              temperature: 0.4,
            });

            let content = completion.choices[0].message.content ?? "";
            content = content
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim();

            const childData = JSON.parse(content);
            const usedColors = newPopulation.map((p) => p.color);

            newPopulation.push({
              ...childData,
              id: makeId(),
              score: 0, // Initialize with zero score
              color: getUnusedColor(usedColors),
              parentIds: [parent1.id, parent2.id],
            });

            // Update state incrementally to show progress (but without scoring)
            if ((j + 1) % 2 === 0 || j === parentPairs.length - 1) {
              setData(
                produce((draft) => {
                  // Make sure this generation exists in the draft before updating it
                  if (draft.generations.length <= currentGenerations.length) {
                    // Add the new generation if it doesn't exist yet
                    draft.generations.push({
                      population: [...newPopulation],
                    });
                  } else {
                    // Otherwise update the existing generation
                    draft.generations[draft.generations.length - 1].population =
                      [...newPopulation];
                  }
                })
              );

              // Short delay to allow UI to update
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }

          // After all pairs are processed, score the entire population at once
          const originalPrompt = currentGenerations[0].population[0].prompt;
          const scoredPopulation = await scorePrompts(
            newPopulation,
            originalPrompt
          );

          // Update the data with scored population
          setData(
            produce((draft) => {
              // Make sure we're updating the correct generation (the last one)
              const lastGenIndex = draft.generations.length - 1;
              if (lastGenIndex >= 0) {
                draft.generations[lastGenIndex].population = scoredPopulation;
              }
            })
          );

          // Update local generations with the scored population
          currentGenerations.push({
            population: scoredPopulation,
          });
        }

        // Update state with current progress
        setData(
          produce((draft) => {
            draft.generations = [...currentGenerations];
          })
        );

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // After all generations are created, generate images if in image mode
      if (mode === "image") {
        const lastGenIndex = currentGenerations.length - 1;
        if (lastGenIndex >= 0) {
          // Generate images for the final generation
          for (
            let i = 0;
            i < currentGenerations[lastGenIndex].population.length;
            i++
          ) {
            const popItem = currentGenerations[lastGenIndex].population[i];
            const prompt = popItem.prompt;
            await generateImage(prompt, lastGenIndex, popItem.id);
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert("Error generating variations");
    } finally {
      setLoading(false);
    }
  };

  // Function to score prompts
  const scorePrompts = async (prompts: any[], originalPrompt: string) => {
    const scoredPrompts = prompts.map((prompt) => ({ ...prompt }));

    const promptsToScore = scoredPrompts.map((p) => p.prompt);

    const completion = await oai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a strict and analytical prompt evaluator. Output only a valid JSON array with objects containing 'id' and 'score' fields.  
            Score each prompt **between 0 and 10** ensuring diverse scores across the set.  
            **Scoring Breakdown:**  
            - **Relevance to Seed (40%)**: Must strongly align with the original seed prompt.  
            - **Creativity (20%)**: Must be fresh, engaging, and unique.  
            - **Coherence (20%)**: Should be clear, logically structured, and meaningful.  
            - **Quality (20%)**: Must have strong potential and readability.  
  
            **Important Guidelines:**  
            - **Do not cluster scores closely**; ensure a clear distinction between weak and strong prompts.  
            - **Reserve high scores (6-10) for truly exceptional prompts**.  
            - **Low scores (0-4) must be used for off-topic, unclear, or unoriginal prompts**.  
            - **Strictly penalize prompts that drift from the core idea of the original seed prompt.**  
            - **Ensure the scoring range is well distributed** (not all scores should be close to each other).`,
        },
        {
          role: "user",
          content: `Evaluate the following prompts in relation to the ORIGINAL SEED PROMPT: "${originalPrompt}". Each prompt has an ID.  
          Return a JSON array in the format [{id: string, score: number}].  
  
          **Prompts to evaluate:**  
          ${promptsToScore
            .map(
              (prompt, idx) =>
                `ID: ${scoredPrompts[idx].id}\nPrompt: ${prompt}\n----------`
            )
            .join("\n")}
  
          **Reminder:** Ensure scores vary significantly and reflect the true quality of each prompt.`,
        },
      ],
      temperature: 0.05,
    });

    let content = completion.choices[0].message.content ?? "";
    content = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    try {
      const scores = JSON.parse(content);
      scores.forEach((scoreData: { id: string; score: number }) => {
        const index = scoredPrompts.findIndex((p) => p.id === scoreData.id);
        if (index >= 0) {
          scoredPrompts[index].score = scoreData.score;
        }
      });
    } catch (error) {
      console.error("Failed to parse scores:", error);
      scoredPrompts.forEach((prompt) => {
        prompt.score = Math.random() * 10;
      });
    }

    return scoredPrompts;
  };

  // Function to create a new project
  const createNewProject = () => {
    const newProjectId = generateProjectId();
    const seedPrompt = "A cute cat"; // Default seed prompt

    // Initialize with default data
    const newProject: Project = {
      id: newProjectId,
      title: seedPrompt, // Use seed prompt as title
      data: {
        population: popLength,
        generations: [
          {
            population: [
              {
                prompt: seedPrompt,
                score: 0.5,
                id: makeId(),
              },
            ],
          },
        ],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Add to projects
    setProjects({
      ...projects,
      [newProjectId]: newProject,
    });

    // Set current project
    setCurrentProjectId(newProjectId);
    setData(newProject.data);

    // Update URL
    window.history.pushState({}, "", `?id=${newProjectId}`);

    // Close projects drawer if open
    setShowProjectsDrawer(false);
  };

  // Function to load a project
  const loadProject = (projectId: string) => {
    if (projects[projectId]) {
      setCurrentProjectId(projectId);
      setData(projects[projectId].data);
      window.history.pushState({}, "", `?id=${projectId}`);
      setShowProjectsDrawer(false);
    }
  };

  // Function to delete a project
  const deleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click handler

    if (confirm("Are you sure you want to delete this project?")) {
      setProjects(
        produce((draft) => {
          delete draft[projectId];
        })
      );

      // If current project is deleted, create a new one
      if (projectId === currentProjectId) {
        createNewProject();
      }
    }
  };

  // Function to clear data except seed
  const clearData = () => {
    if (!currentProjectId) return;

    // Keep only the first generation (seed) and reset the data
    setData(
      produce((draft) => {
        const seedPopulation = draft.generations[0].population[0];
        draft.generations = [
          {
            population: [
              {
                ...seedPopulation,
              },
            ],
          },
        ];
      })
    );
  };

  // Function to generate all images for the current view
  const generateAllImages = async () => {
    // Get all cards without images from all generations
    const itemsToGenerate: {
      popId: string;
      genIndex: number;
      prompt: string;
    }[] = [];

    data.generations.forEach((gen, genIndex) => {
      gen.population.forEach((pop) => {
        if (!pop.image && !imageGenerating[pop.id]) {
          itemsToGenerate.push({
            popId: pop.id,
            genIndex,
            prompt: pop.prompt,
          });
        }
      });
    });

    if (itemsToGenerate.length === 0) return;

    // Set up the batch generation tracking
    setGeneratingAllImages({
      active: true,
      total: itemsToGenerate.length,
      completed: 0,
    });

    // Generate images one by one
    for (const item of itemsToGenerate) {
      await generateImage(item.prompt, item.genIndex, item.popId);

      // Update the progress counter
      setGeneratingAllImages((prev) => ({
        ...prev,
        completed: prev.completed + 1,
      }));
    }

    // Reset when done
    setGeneratingAllImages({
      active: false,
      total: 0,
      completed: 0,
    });
  };

  // Function to generate images for a specific generation
  const generateImagesForGeneration = async (genIndex: number) => {
    if (!data.generations[genIndex]) return;

    // Get items without images in this generation
    const itemsToGenerate: { popId: string; prompt: string }[] = [];

    data.generations[genIndex].population.forEach((pop) => {
      if (!pop.image && !imageGenerating[pop.id]) {
        itemsToGenerate.push({
          popId: pop.id,
          prompt: pop.prompt,
        });
      }
    });

    if (itemsToGenerate.length === 0) return;

    // Set up the batch generation tracking
    setGeneratingAllImages({
      active: true,
      total: itemsToGenerate.length,
      completed: 0,
    });

    // Generate images one by one
    for (const item of itemsToGenerate) {
      await generateImage(item.prompt, genIndex, item.popId);

      // Update the progress counter
      setGeneratingAllImages((prev) => ({
        ...prev,
        completed: prev.completed + 1,
      }));
    }

    // Reset when done
    setGeneratingAllImages({
      active: false,
      total: 0,
      completed: 0,
    });
  };

  return (
    <div className="size-full">
      <div className="flex justify-between p-4 w-full h-16">
        <div className="flex items-center gap-3">
          <h2 className="text-lg">Evolve</h2>
          <button
            className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg text-xs"
            onClick={createNewProject}
          >
            New Project
          </button>
          <button
            className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg text-xs"
            onClick={() => setShowProjectsDrawer(!showProjectsDrawer)}
          >
            Projects
          </button>
          <button
            className="bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg text-red-600 text-xs"
            onClick={clearData}
          >
            Clear
          </button>
          {currentProjectId && projects[currentProjectId] && (
            <div className="text-gray-500 text-xs">
              Project: {projects[currentProjectId].title?.substring(0, 30)}
              {projects[currentProjectId].title?.length > 30 && "..."}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            className={`px-3 py-1 rounded-lg ${
              mode === "prompt" ? "bg-[#F3BD21] text-white" : "bg-gray-100"
            }`}
            onClick={() => setMode("prompt")}
          >
            Prompt
          </button>
          <button
            className={`px-3 py-1 rounded-lg ${
              mode === "image" ? "bg-[#F3BD21] text-white" : "bg-gray-100"
            }`}
            onClick={() => setMode("image")}
          >
            Image
          </button>
          <button
            className={`px-3 py-1 rounded-lg ${
              mode === "p5" ? "bg-[#F3BD21] text-white" : "bg-gray-100"
            }`}
            onClick={() => setMode("p5")}
          >
            P5
          </button>

          {mode === "image" && (
            <>
              <button
                className="bg-gray-800 hover:bg-gray-700 ml-2 px-3 py-1 rounded-lg text-white text-xs"
                onClick={generateAllImages}
                disabled={generatingAllImages.active}
              >
                {generatingAllImages.active
                  ? `Generating ${generatingAllImages.completed}/${generatingAllImages.total}`
                  : "Generate All Images"}
              </button>
              <div className="flex items-center gap-2 ml-4">
                <label
                  htmlFor="preview-toggle"
                  className="text-gray-600 text-sm"
                >
                  Full Previews
                </label>
                <input
                  id="preview-toggle"
                  type="checkbox"
                  checked={showFullPreviews}
                  onChange={(e) => setShowFullPreviews(e.target.checked)}
                  className="toggle"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Projects drawer */}
      {showProjectsDrawer && (
        <div className="top-16 bottom-0 left-0 z-50 fixed bg-white shadow-lg p-4 w-64 overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Projects</h3>
            <button
              onClick={() => setShowProjectsDrawer(false)}
              className="text-gray-500 hover:text-gray-800"
            >
              ×
            </button>
          </div>

          {Object.keys(projects).length === 0 ? (
            <p className="text-gray-500 text-sm">No projects yet</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(projects)
                .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
                .map(([id, project]) => (
                  <li
                    key={id}
                    className={`p-2 rounded cursor-pointer hover:bg-gray-100 flex justify-between ${
                      id === currentProjectId ? "bg-gray-100" : ""
                    }`}
                    onClick={() => {
                      loadProject(id);
                      window.location.reload();
                    }}
                  >
                    <div className="flex-1 truncate">
                      <p className="font-medium truncate">{project.title}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(project.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteProject(id, e)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col justify-center gap-2 mx-auto max-w-7xl container">
        {data.generations.map((gen, geni) => {
          return (
            <div key={`gen-${geni}`} className="relative flex flex-col gap-2">
              {geni > 0 && (
                <div className="flex justify-between items-center mb-1 px-2 w-full text-gray-800">
                  <span className="font-bold text-xl">Gen {geni}</span>
                  {mode === "image" && (
                    <button
                      className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded-lg text-white text-xs"
                      onClick={() => generateImagesForGeneration(geni)}
                    >
                      Generate Images
                    </button>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-2">
                {[...gen.population]
                  .sort((a, b) => b.score - a.score)
                  .map((pop, pi) => {
                    return (
                      <Popover
                        key={pi}
                        isOpen={
                          mode === "image" &&
                          !showFullPreviews &&
                          !!pop.image &&
                          !!popoverOpen[pop.id]
                        }
                        positions={["bottom"]}
                        padding={10}
                        content={
                          mode === "image" && !showFullPreviews && pop.image ? (
                            <div className="bg-white shadow-lg p-1 border rounded-lg">
                              <img
                                src={pop.image}
                                alt={pop.prompt}
                                className="rounded max-w-[300px]"
                              />
                            </div>
                          ) : null
                        }
                        onClickOutside={() => {
                          setPopoverOpen((prev) => ({
                            ...prev,
                            [pop.id]: false,
                          }));
                        }}
                      >
                        <div
                          className="relative flex flex-col justify-between gap-3 p-3 rounded-2xl w-64 h-40 text-sm"
                          style={{
                            backgroundColor: pop.color ?? "#FAE29F",
                            backgroundImage:
                              mode === "image" && showFullPreviews && pop.image
                                ? `url(${pop.image})`
                                : "none",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                          onMouseEnter={() => {
                            if (
                              mode === "image" &&
                              !showFullPreviews &&
                              pop.image
                            ) {
                              setPopoverOpen((prev) => ({
                                ...prev,
                                [pop.id]: true,
                              }));
                            }
                          }}
                          onMouseLeave={() => {
                            if (
                              mode === "image" &&
                              !showFullPreviews &&
                              pop.image
                            ) {
                              setPopoverOpen((prev) => ({
                                ...prev,
                                [pop.id]: false,
                              }));
                            }
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1">
                              <span
                                className={
                                  mode === "image" &&
                                  showFullPreviews &&
                                  pop.image
                                    ? "text-white text-shadow"
                                    : ""
                                }
                              >
                                {geni == 0 && pi == 0 ? "Seed" : `#${pi + 1}`}
                              </span>
                              {pop.parentIds && (
                                <div className="flex gap-1 bg-white ml-1 p-1 rounded-lg">
                                  {pop.parentIds.map((parentId, idx) => {
                                    const parent =
                                      geni > 0
                                        ? data.generations[
                                            geni - 1
                                          ].population.find(
                                            (p) => p.id === parentId
                                          )
                                        : null;
                                    return parent ? (
                                      <div
                                        key={idx}
                                        className="rounded-full w-3 h-3"
                                        style={{
                                          backgroundColor: parent.color,
                                        }}
                                      />
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                            <span
                              className={
                                mode === "image" &&
                                showFullPreviews &&
                                pop.image
                                  ? "text-white text-shadow"
                                  : ""
                              }
                            >
                              {pop.score.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-full">
                            {!(
                              mode === "image" &&
                              showFullPreviews &&
                              pop.image
                            ) && (
                              <textarea
                                className="outline-0 size-full resize-none"
                                value={pop.prompt}
                                onChange={(e) => {
                                  setData(
                                    produce((draft) => {
                                      draft.generations[geni].population[
                                        pi
                                      ].prompt = e.target.value;
                                    })
                                  );
                                }}
                              />
                            )}
                          </div>
                          {geni == 0 && pi == 0 && (
                            <div className="flex justify-end w-full">
                              <button
                                className="gap-2 bg-[#F3BD21] hover:bg-[#F3BD21]/80 disabled:opacity-50 p-2 rounded-xl w-16 text-white text-sm active:scale-95 cursor-pointer"
                                onClick={go}
                                disabled={loading}
                              >
                                {loading ? "..." : "go"}
                              </button>
                            </div>
                          )}
                          {mode === "image" && !pop.image && (
                            <div
                              className="right-3 bottom-3 left-3 absolute"
                              onClick={() => {
                                if (!imageGenerating[pop.id]) {
                                  generateImage(pop.prompt, geni, pop.id);
                                }
                              }}
                            >
                              <button
                                className="flex justify-center items-center gap-1 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded-lg w-full text-white text-xs"
                                disabled={!!imageGenerating[pop.id]}
                              >
                                {imageGenerating[pop.id] ? (
                                  <span>Generating...</span>
                                ) : (
                                  <span>Generate Image</span>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </Popover>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add a global style for text shadow to improve readability on image backgrounds */}
      <style jsx global>{`
        .text-shadow {
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8),
            0 1px 5px rgba(0, 0, 0, 0.6);
        }
      `}</style>
    </div>
  );
}

export default App;
