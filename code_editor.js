async function init() {
	var is_default_user = document.cookie.lenght === 0;
	var token = await get_token();
	var task_data = null;
	if(token) {
		task_data = await get_task_data(token, true);
	}

	const err_func = (e, msg) => {
		const p = document.createElement('p');
		p.textContent = `Sorry, testing is currently unavailable: ${msg}. Try again later.`;
		e.appendChild(p);
	};

	for(var e of document.getElementsByClassName('test_section')) {
		if(!token) {
			err_func(e, 'can not create test account');
			continue;
		}

		if(!task_data) {
			err_func(e, 'no testing data');
			continue;
		}

		const folders = e.id.split('__');
		const project = task_data[folders[1]];
		if(!project) {
			err_func(e, 'project for this task is not found');
			continue;
		}
		const unit = project['units'][folders[2]];
		if(!unit) {
			err_func(e, 'unit for this task is not found');
			continue;
		}
		const task = unit['tasks'][folders[3]];
		if(!task) {
			err_func(e, 'no such task in testing data');
			continue;
		}
		const task_id = task['id'];

		const login = document.createElement('div');
		login.classList.add('login');

		const email_label = document.createElement('label');
		email_label.classList.add('login_label');
		email_label.innerHTML = 'Login:';
		const email = document.createElement('input');
		email.classList.add('login_field');

		const pass_label = document.createElement('label');
		pass_label.classList.add('login_label');
		pass_label.innerHTML = 'Pass:';
		const pass = document.createElement('input');
		pass.classList.add('login_field');

		const button_label = document.createElement('label');
		button_label.classList.add('login_error');
		button_label.hidden = true;
		const login_button = document.createElement('button');
		login_button.classList.add('login_button');
		login_button.innerHTML = 'Sign in to test solution';

		login.appendChild(email_label);
		login.appendChild(email);
		login.appendChild(pass_label);
		login.appendChild(pass);
		login.appendChild(button_label);
		login.appendChild(login_button);

		const source_text = create_code_editor();
		source_text.classList.add('source_text');

		const test_log = document.createElement('textarea');
		test_log.classList.add('test_log');
		test_log.classList.add('pending_test');
		test_log.readOnly = true;
		test_log.value = `Inside solution text area press:
Ctrl+D - to show task Description
Ctrl+L - to show Logs
Ctrl+S - to Send solution`;

		if(token !== null) {
			login.classList.add('hidden');
		} else {
			test_log.hidden = true;
		}

		source_text.addEventListener('keypress', async function(event) {
			if (!event.ctrlKey || event.keyCode !== 13) {
				return
			}
			this.disabled = true;
			await send_test(task_id, this.childNodes[1].value, test_log);
			this.disabled = false;
		});

		login_button.addEventListener('click', async function(event) {
			const data = await get_token(email.value, pass.value);
			if(data['error'] != null) {
				button_label.hidden = false;
				button_label.innerHTML = data['error'];
				return
			}
			button_label.hidden = true;
			document.cookie = `token=${data['token']};Secure`;
			login.classList.add("hidden")
			test_log.hidden = false;
		});

		e.appendChild(source_text);
		e.appendChild(test_log);
		e.appendChild(login);
	}
}

function get_cookie_token() {
	if(document.cookie === '') {
		return null;
	}
	var token = document.cookie.split(';');
	if(token.lenght > 0) {
		return null;
	}
	token = token[0].split('=');
	if(token.lenght > 1) {
		return null;
	}
	token = token[1];
	if(token.length === 256) {
		return token;
	}
	return null;
}

async function get_task_data(token, is_folder) {
	const resp = await fetch(`https://kee-reel.com/cyber-cat?token=${token}&folders=${is_folder}`)
	return await resp.json()
}

async function get_token(email, pass) {
	const token = get_cookie_token();
	if(token) {
		return token;
	}
	else if(!email && !pass)
	{
		const default_email = 'test@test.com';
		const default_pass = '123456';
		data = await get_token(default_email, default_pass);
		if(!data['error']) {
			return data['token'];
		}
		return null;
	}
	const resp = await fetch(`https://kee-reel.com/cyber-cat/login?email=${email}&pass=${pass}`)
	return await resp.json()
}

async function send_test(task_id, source_text, test_log) {
	var token = await get_token();
	var task_data = null;

	const formData = new FormData();
	formData.append('task_id', task_id);
	formData.append('source_text', source_text);

	test_log.value = 'Sending request...';
	test_log.classList.add('pending_test');
	test_log.classList.remove('failed_test');
	test_log.classList.remove('passed_test');

	const resp = await fetch(`https://kee-reel.com/cyber-cat?token=${token}`, {method: 'POST', body: formData})
	const data = await resp.json()

	test_log.classList.remove('pending_test');
	if (data['error'] == null) {
		test_log.value = 'Yay! No errors!';
		test_log.classList.add('passed_test');
	} else {
		test_log.classList.add('failed_test');
		var err = data['error'];
		switch(err['stage']) {
			case 'build':
				test_log.value = `Solution build error:
${err['msg']}`;
				break;
			case 'test':
				text = 'Test failed:'
				if(err['params']) {
					text += `
Test parameters: ${err['params'].split(';')}`;
				}
				text += `
Expected result: ${err['expected']}
Actual result: ${err['result']}`;
				test_log.value = text;
				break;
			default:
				test_log.value = err['error'];
		}
	}
}

function create_code_editor() {
	const div = document.createElement('div');

	const pre = document.createElement('pre');
	pre.classList.add('highlighting');
	pre.ariaHidden = true;

	const code = document.createElement('code');
	code.classList.add('language-c');
	code.classList.add('highlighting-content');

	const textarea = document.createElement('textarea');
	textarea.classList.add('editing');
	textarea.spellcheck = false;
	textarea.addEventListener('input', async function(event) {
		update(this.value, code);
		sync_scroll(this, pre);
	});
	textarea.addEventListener('scroll', async function(event) {
		sync_scroll(this, pre);
	});
	textarea.addEventListener('keydown', async function(event) {
		check_tab(this, event);
	});

	pre.appendChild(code);
	div.appendChild(pre);
	div.appendChild(textarea);
	return div;
}

function update(text, result_element) {
  if(!result_element) {
	  return;
  }
  // Handle final newlines (see article)
  if(text[text.length-1] == "\n") {
    text += " ";
  }
  // Update code
  result_element.innerHTML = text.replace(new RegExp("&", "g"), "&amp;").replace(new RegExp("<", "g"), "&lt;"); /* Global RegExp */
  Prism.highlightElement(result_element); // Syntax Highlight
}

function sync_scroll(element, result_element) {
	/* Scroll result to scroll coords of event - sync with textarea */
	// Get and set x and y
	result_element.scrollTop = element.scrollTop;
	result_element.scrollLeft = element.scrollLeft;
}

function check_tab(element, event) {
	if(event.key === "Tab") {
		let code = element.value;
		/* Tab key pressed */
		event.preventDefault(); // stop normal
		let before_tab = code.slice(0, element.selectionStart); // text before tab
		let after_tab = code.slice(element.selectionEnd, element.value.length); // text after tab
		let cursor_pos = element.selectionEnd + 4; // where cursor moves after tab - moving forward by 1 char to after tab
		element.value = before_tab + "    " + after_tab; // add tab char
		// move cursor
		element.selectionStart = cursor_pos;
		element.selectionEnd = cursor_pos;
		update(element.value); // Update text to include indent
	}
}

init();
