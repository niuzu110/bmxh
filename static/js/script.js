document.addEventListener('DOMContentLoaded', () => {
    const modelSelect = document.getElementById('model-select');
    const novelList = document.getElementById('novel-list');
    const statusIndicator = document.getElementById('status-indicator');
    const ollamaAddress = document.getElementById('ollama-address');
    const newNovelBtn = document.getElementById('new-novel-btn');
    const generateBtn = document.getElementById('generate-btn');
    const continueBtn = document.getElementById('continue-btn');
    const promptInput = document.getElementById('prompt-input');
    const novelContent = document.getElementById('novel-content');
    const outputText = document.getElementById('output-text');
    const generatedOutputDiv = document.getElementById('generated-output');
    const writingArea = document.getElementById('writing-area');
    const welcomeScreen = document.getElementById('welcome-screen');
    const writingNovelTitle = document.getElementById('writing-novel-title');
    const toolboxArea = document.getElementById('toolbox-area');
    const toolboxBtns = document.querySelectorAll('.tool-btn');
    const toolboxTitle = document.getElementById('toolbox-title');
    const toolboxPrompt = document.getElementById('toolbox-prompt');
    const toolboxGenerateBtn = document.getElementById('toolbox-generate-btn');
    const toolboxOutputText = document.getElementById('toolbox-output-text');
    const toolboxOutputDiv = document.getElementById('toolbox-output');
    const saveNovelBtn = document.getElementById('save-novel-btn');
    // Metadata Inputs
    const charactersInput = document.getElementById('characters-input');
    const knowledgeInput = document.getElementById('knowledge-input');
    const promptLibraryInput = document.getElementById('prompt-library-input');
    // Export Buttons
    const exportTxtBtn = document.getElementById('export-txt-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');
    const exportDocxBtn = document.getElementById('export-docx-btn');
    // Word Count Display
    const wordCountDisplay = document.getElementById('word-count-display');

    let currentNovelId = null; // Track the currently open novel
    let isSaving = false;

    // --- Initialization ---

    function updateStatus(message, isError = false) {
        statusIndicator.textContent = message;
        statusIndicator.style.color = isError ? 'red' : '#a0aec0'; // Use CSS color for normal
        console.log(`Status: ${message}`);
        if (isError) console.error(message);
    }

    async function fetchModels() {
        updateStatus('正在加载模型...');
        try {
            const response = await fetch('/api/models');
            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) { /* Ignore if response is not JSON */ }
                throw new Error(errorMsg);
            }
            const models = await response.json();

            modelSelect.innerHTML = '<option value="">-- 请选择模型 --</option>';
            if (models && models.length > 0) {
                models.forEach(modelName => {
                    const option = document.createElement('option');
                    option.value = modelName;
                    option.textContent = modelName;
                    modelSelect.appendChild(option);
                });
                updateStatus('模型加载完毕。');
            } else {
                modelSelect.innerHTML = '<option value="">-- 未找到模型 --</option>';
                updateStatus('未能通过API找到模型。', true);
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            modelSelect.innerHTML = '<option value="">-- 加载模型出错 --</option>';
            const errorText = `加载模型出错: ${error.message}`;
            updateStatus(errorText, true);
            // Display the error in the welcome screen as well
            if (welcomeScreen && !welcomeScreen.classList.contains('hidden')) {
                let errorP = welcomeScreen.querySelector('.error-message');
                if (!errorP) {
                    errorP = document.createElement('p');
                    errorP.style.color = 'red';
                    errorP.className = 'error-message'; // Add class for potential removal
                    welcomeScreen.appendChild(errorP);
                }
                errorP.textContent = `无法从 Ollama 获取模型。请确保其正在运行且可访问。错误: ${error.message}`;
            }
        }
    }

    async function fetchNovels() {
        updateStatus('正在加载小说列表...');
        try {
            const response = await fetch('/api/novels');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const novels = await response.json();
            novelList.innerHTML = ''; // Clear loading message
            if (novels && novels.length > 0) {
                novels.forEach(novel => {
                    const li = document.createElement('li');
                    li.dataset.novelId = novel.id; // Store ID on the li itself

                    const titleSpan = document.createElement('span');
                    titleSpan.textContent = novel.title;
                    titleSpan.style.flexGrow = '1'; // Allow title to take space
                    titleSpan.style.cursor = 'pointer';
                    titleSpan.addEventListener('click', () => loadNovel(novel.id));

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; // Use Font Awesome icon
                    deleteBtn.title = `删除小说 '${novel.title}'`;
                    deleteBtn.classList.add('delete-novel-btn'); // Add class for styling
                    deleteBtn.style.marginLeft = '10px';
                    deleteBtn.style.padding = '2px 5px';
                    deleteBtn.style.border = 'none';
                    deleteBtn.style.background = 'none';
                    deleteBtn.style.color = '#e53e3e'; // Red color
                    deleteBtn.style.cursor = 'pointer';
                    deleteBtn.style.fontSize = '0.9em';

                    deleteBtn.addEventListener('click', (event) => {
                        event.stopPropagation(); // Prevent li click event when clicking button
                        if (confirm(`您确定要删除小说 "${novel.title}" 吗？此操作无法撤销。`)) {
                            deleteNovelById(novel.id);
                        }
                    });

                    li.appendChild(titleSpan);
                    li.appendChild(deleteBtn);
                    novelList.appendChild(li);
                });
                updateStatus('小说列表加载完毕。');
            } else {
                novelList.innerHTML = '<li>未找到任何小说。请创建一个！</li>';
                updateStatus('尚无小说。');
            }
        } catch (error) {
            console.error('Error fetching novels:', error);
            novelList.innerHTML = '<li>加载小说列表出错。</li>';
            updateStatus(`加载小说列表出错: ${error.message}`, true);
        }
    }

    // --- Novel Management ---

    async function loadNovel(novelId) {
        if (isSaving) {
            alert("请稍候，正在保存上一部小说...");
            return;
        }
        updateStatus(`正在加载小说 ${novelId}...`);
        // Hide other views
        welcomeScreen.classList.add('hidden');
        toolboxArea.classList.add('hidden');
        generatedOutputDiv.classList.add('hidden'); // Hide previous output
        outputText.textContent = '';

        try {
            const response = await fetch(`/api/novels/${novelId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const novel = await response.json();

            currentNovelId = novel.id;
            writingNovelTitle.textContent = novel.title;
            novelContent.value = novel.content || ''; // Handle potentially empty content
            promptInput.value = ''; // Clear previous prompt
            // Load metadata
            charactersInput.value = novel.characters || '';
            knowledgeInput.value = novel.knowledge || '';
            promptLibraryInput.value = novel.prompt_library || '';

            // Highlight selected novel in the list
            document.querySelectorAll('#novel-list li').forEach(li => {
                li.classList.toggle('active', li.dataset.novelId === novelId);
            });

            writingArea.classList.remove('hidden'); // Show writing area
            updateStatus(`小说 '${novel.title}' 已加载。`);
            updateWordCount(); // Update word count when novel loads

            // Ensure generate buttons are enabled when viewing the writing area
            generateBtn.disabled = false;
            continueBtn.disabled = false;

        } catch (error) {
            console.error(`Error loading novel ${novelId}:`, error);
            updateStatus(`加载小说出错: ${error.message}`, true);
            // Optionally, show welcome screen again or an error message
            welcomeScreen.classList.remove('hidden');
            writingArea.classList.add('hidden');
            currentNovelId = null;
        }
    }

    async function createNewNovel() {
        if (isSaving) {
            alert("请稍候，正在保存上一部小说...");
            return;
        }
        const title = prompt("请输入新小说的标题:", "未命名小说");
        if (!title) return; // User cancelled

        updateStatus('正在创建新小说...');
        try {
            const response = await fetch('/api/novels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title })
            });
            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                 try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                 } catch (e) { /* Ignore if response is not JSON */ }
                 throw new Error(errorMsg);
            }
            const newNovel = await response.json();
            updateStatus(`小说 '${title}' 已创建。`);
            await fetchNovels(); // Refresh list
            // Automatically load the newly created novel
            // Ensure fetchNovels completes before trying to load
            setTimeout(() => loadNovel(newNovel.id), 100); // Small delay to ensure UI update

        } catch (error) {
            console.error('Error creating novel:', error);
            updateStatus(`创建小说出错: ${error.message}`, true);
            alert(`创建小说失败: ${error.message}`);
        }
    }

    async function saveNovelContent() {
        if (!currentNovelId) {
            console.warn("未选择当前小说，无法保存。");
            return;
        }
        if (isSaving) {
            console.warn("保存操作已在进行中。");
            return;
        }

        isSaving = true;
        updateStatus('正在保存小说...');
        saveNovelBtn.disabled = true;

        try {
            const response = await fetch(`/api/novels/${currentNovelId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: novelContent.value,
                    characters: charactersInput.value,
                    knowledge: knowledgeInput.value,
                    prompt_library: promptLibraryInput.value
                 })
            });

             if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            // const result = await response.json(); // Optional: Check result message
            updateStatus('小说保存成功。');

        } catch (error) {
            console.error('Error saving novel:', error);
            updateStatus(`保存小说出错: ${error.message}`, true);
            alert(`保存小说失败: ${error.message}`);
        } finally {
            isSaving = false;
            saveNovelBtn.disabled = false;
        }
    }

    async function deleteNovelById(novelId) {
        if (!novelId) return;

        updateStatus(`正在删除小说 ${novelId}...`);
        try {
            const response = await fetch(`/api/novels/${novelId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            updateStatus(result.message || `小说 ${novelId} 已删除。`);

            // Remove the novel from the list UI
            const listItem = novelList.querySelector(`li[data-novel-id="${novelId}"]`);
            if (listItem) {
                listItem.remove();
            }

            // If the deleted novel was the currently loaded one, clear the editor
            if (currentNovelId === novelId) {
                writingArea.classList.add('hidden');
                welcomeScreen.classList.remove('hidden');
                currentNovelId = null;
                writingNovelTitle.textContent = "小说标题"; // Reset title
                novelContent.value = '';
                charactersInput.value = '';
                knowledgeInput.value = '';
                promptLibraryInput.value = '';
                promptInput.value = '';
                outputText.textContent = '';
                generatedOutputDiv.classList.add('hidden');
                updateWordCount(); // Reset word count display
            }

             // Check if the list is now empty
             if (novelList.children.length === 0) {
                 novelList.innerHTML = '<li>未找到任何小说。请创建一个！</li>';
                 updateStatus('尚无小说。');
             }

        } catch (error) {
            console.error(`Error deleting novel ${novelId}:`, error);
            const errorText = `删除小说失败: ${error.message}`;
            updateStatus(errorText, true);
            alert(errorText);
        }
    }

    // --- Text Generation ---

    async function generateText(isContinuation = false) {
        const selectedModel = modelSelect.value;
        const currentPrompt = promptInput.value.trim();
        const currentContent = novelContent.value;
        const characters = charactersInput.value.trim();
        const knowledge = knowledgeInput.value.trim();

        if (!selectedModel) {
            alert("请先选择一个 AI 模型。");
            return;
        }
        if (!currentNovelId) {
            alert("请先加载或创建一部小说。");
            return;
        }

        let fullPrompt = "";
        if (isContinuation) {
            // Basic continuation: use existing content as context
            if (!currentContent.trim()) {
                alert("小说内容为空，无法继续。");
                return;
            }
            fullPrompt = currentContent; // Send the entire current content as prompt
            updateStatus(`正在使用 ${selectedModel} 继续写作...`);
        } else {
            if (!currentPrompt) {
                alert("请输入提示。");
                return;
            }
            // Construct prompt with metadata and user prompt
            fullPrompt = ``;
            if (characters) {
                fullPrompt += `角色设定:\n${characters}\n\n`;
            }
            if (knowledge) {
                fullPrompt += `关联知识:\n${knowledge}\n\n`;
            }
            fullPrompt += `写作提示:\n${currentPrompt}`;
            // Note: Could also include currentContent as context here if desired.

            updateStatus(`正在根据提示使用 ${selectedModel} 生成文本...`);
        }

        // Disable buttons and show loading state
        generateBtn.disabled = true;
        continueBtn.disabled = true;
        generatedOutputDiv.classList.remove('hidden');
        outputText.textContent = '生成中...';

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: fullPrompt,
                    // stream: false // Stream handling not implemented yet
                })
            });

            if (!response.ok) {
                 let errorMsg = `HTTP error! status: ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch (e) { /* Ignore */ }
                 throw new Error(errorMsg);
            }

            const result = await response.json();
            const generated = result.generated_text || "";
            outputText.textContent = generated || "未能生成文本。";
            updateStatus('生成完毕。');

            // Append generated text to the main content area
            // Add a newline if content already exists
            // Consider inserting at cursor later
            novelContent.value += (novelContent.value.trim() ? '\n\n' : '') + generated.trim();

            // Automatically save after generation (optional)
            // await saveNovelContent();

        } catch (error) {
            console.error('Error generating text:', error);
            outputText.textContent = `错误: ${error.message}`;
            updateStatus(`生成失败: ${error.message}`, true);
        } finally {
            // Re-enable buttons
            generateBtn.disabled = false;
            continueBtn.disabled = false;
        }
    }

    // --- Toolbox ---

    function showToolbox(toolType) {
        welcomeScreen.classList.add('hidden');
        writingArea.classList.add('hidden');
        toolboxArea.classList.remove('hidden');
        toolboxOutputDiv.classList.add('hidden'); // Hide previous output
        toolboxOutputText.textContent = '';

        // Customize toolbox based on toolType
        let title = "工具箱";
        let promptPlaceholder = "输入内容或关键词...";
        if (toolType === 'title') {
            title = "书名生成器";
            promptPlaceholder = "输入书籍的主题、类型或关键词...";
        } else if (toolType === 'outline') {
            title = "大纲生成器";
            promptPlaceholder = "描述主要情节、角色或主题...";
        } else if (toolType === 'detailed-outline') {
            title = "细纲生成器";
            promptPlaceholder = "提供基本大纲或关键场景构想...";
        }

        toolboxTitle.textContent = title;
        toolboxPrompt.placeholder = promptPlaceholder;
        toolboxPrompt.value = ''; // Clear previous prompt
        updateStatus(`${title} 已就绪。`);
        // Store the current tool type for the generate button
        toolboxGenerateBtn.dataset.toolType = toolType;
    }

    async function generateToolboxOutput() {
        const toolType = toolboxGenerateBtn.dataset.toolType;
        const selectedModel = modelSelect.value;
        const prompt = toolboxPrompt.value.trim();
        const characters = charactersInput.value.trim();
        const knowledge = knowledgeInput.value.trim();

        if (!selectedModel) {
            alert("请先选择一个 AI 模型。");
            return;
        }
        if (!prompt) {
            alert("请输入生成器所需的内容或关键词。");
            return;
        }
        if (!toolType) {
            console.error("Tool type not set for toolbox generation.");
            alert("发生内部错误：未指定工具类型。");
            return;
        }

        let toolTitle = "工具";
        if(toolType === 'title') toolTitle = "书名";
        else if(toolType === 'outline') toolTitle = "大纲";
        else if(toolType === 'detailed-outline') toolTitle = "细纲";

        updateStatus(`正在使用 ${selectedModel} 生成 ${toolTitle}...`);
        toolboxGenerateBtn.disabled = true;
        toolboxOutputDiv.classList.remove('hidden');
        toolboxOutputText.textContent = '生成中...';

        // Construct a more specific prompt for the model based on the tool
        let generationPrompt = "";
        let baseContext = ""; // Prepare context from metadata if available
        if (characters) {
            baseContext += `角色设定:\n${characters}\n\n`;
        }
        if (knowledge) {
            baseContext += `关联知识:\n${knowledge}\n\n`;
        }

        if (toolType === 'title') {
            generationPrompt = `${baseContext}根据以下主题/关键词生成5个可能的书名: ${prompt}`;
        } else if (toolType === 'outline') {
            generationPrompt = `${baseContext}根据以下描述为故事创建一个基本情节大纲（主要部分或幕）: ${prompt}`;
        } else if (toolType === 'detailed-outline') {
            generationPrompt = `${baseContext}将以下内容扩展为更详细的逐章或逐场景大纲: ${prompt}`;
        } else {
            // Fallback - might not be ideal, but uses the user input directly
            generationPrompt = `${baseContext}写作提示:\n${prompt}`;
            console.warn("无法识别工具类型以生成特定提示，将使用基本提示。");
        }

        try {
            // Use the same /api/generate endpoint
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: generationPrompt
                })
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            toolboxOutputText.textContent = result.generated_text || "未能生成输出。";
            updateStatus(`${toolTitle} 生成完毕。`);

        } catch (error) {
            console.error(`Error generating ${toolType}:`, error);
            toolboxOutputText.textContent = `错误: ${error.message}`;
            updateStatus(`工具箱生成失败: ${error.message}`, true);
        } finally {
            toolboxGenerateBtn.disabled = false;
        }
    }

    // --- Export Functions (Now call backend) ---

    async function exportNovel(format) {
        if (!currentNovelId) {
            alert("请先加载或创建一部小说以进行导出。");
            return;
        }

        updateStatus(`正在请求导出为 ${format.toUpperCase()}...`);
        // Disable buttons temporarily?
        exportTxtBtn.disabled = true;
        exportJsonBtn.disabled = true;
        exportDocxBtn.disabled = true;

        try {
            const response = await fetch(`/api/novels/${currentNovelId}/export/${format}`, {
                method: 'POST'
                // No body needed, the server knows the novel ID
            });

            const result = await response.json(); // Always expect JSON response now

            if (!response.ok) {
                throw new Error(result.error || `导出时发生未知错误 (HTTP ${response.status})`);
            }

            updateStatus(result.message || `文件已成功导出至服务器 (${format})。`);
            // Maybe show the path briefly?
            alert(result.message); // Simple alert confirmation

        } catch (error) {
            console.error(`Error exporting novel as ${format}:`, error);
            const errorText = `导出 ${format.toUpperCase()} 失败: ${error.message}`;
            updateStatus(errorText, true);
            alert(errorText);
        } finally {
            // Re-enable buttons
            exportTxtBtn.disabled = false;
            exportJsonBtn.disabled = false;
            exportDocxBtn.disabled = false;
        }
    }

    // --- Word Count --- TODO: Improve CJK word count if needed
    function updateWordCount() {
        console.log("updateWordCount called"); // Log: Function called
        if (!wordCountDisplay) {
            console.error("Word count display element not found!"); // Log: Element missing
            return;
        }

        const text = novelContent.value || '';
        console.log("Text for word count:", text.substring(0, 50) + "..."); // Log: Text sample
        // Simple word count (split by space/newline, filter empty)
        // For CJK, counting non-space characters might be more common.
        // Let's use non-space character count for simplicity here.
        const wordCount = text.replace(/\s+/g, '').length; // Count non-whitespace chars
        // Alternative: const wordCount = (text.match(/\S+/g) || []).length;
        console.log("Calculated word count:", wordCount); // Log: Calculated count

        wordCountDisplay.textContent = `字数: ${wordCount}`;
    }

    // --- Event Listeners ---

    newNovelBtn.addEventListener('click', createNewNovel);
    generateBtn.addEventListener('click', () => generateText(false)); // Generate from prompt
    continueBtn.addEventListener('click', () => generateText(true)); // Continue from content
    toolboxGenerateBtn.addEventListener('click', generateToolboxOutput);
    saveNovelBtn.addEventListener('click', saveNovelContent);

    // Word Count Listener
    novelContent.addEventListener('input', updateWordCount);

    // Export Listeners (point to new generic function)
    exportTxtBtn.addEventListener('click', () => exportNovel('txt'));
    exportJsonBtn.addEventListener('click', () => exportNovel('json'));
    exportDocxBtn.addEventListener('click', () => exportNovel('docx'));

    toolboxBtns.forEach(btn => {
        btn.addEventListener('click', () => showToolbox(btn.dataset.tool));
    });

    // --- Initial Load ---

    fetchModels();
    fetchNovels();
    // Ollama address is initially set in HTML, could be fetched from config later

}); 