import Vue from '../store.js'
import notify from '../stores/notification.js'
import PredictService from '../../services/predict.service.js';
import ApiService from '../../services/api.service.js';
import { $array, $object, $file, $number } from 'https://unpkg.com/alga-js@0.1.0-wood-5/dist/alga.min.js?module';
import Category from '../stores/category.js';

const Transaction = (props) => ({
    service: new PredictService(),
    api: new ApiService(),
    pageActive: 1, //or currentPage
    limitPerPage: 10, //or currentEntries
    pageInfo: {}, //or show
    totalPages: 1, //or allPages
    loader: false,
    search: '',
    success: null,
    table_error: null,
    table_loader: false,
    checkbox: false,
    isFormOpen: false,
    total_amount: 0,
    filteredEntries: [],
    wordList: [],
    amountList: [],
    categories: categoryList,
    addAmount: false,
    listening: false,
    recognition: null,
    categoryPattern: [],
    audioText: '',
    form: {
        id: null,
        type: 'expense',
        amount: 0,
        category_id: null,
        date: currentDate,
        description: '',
    },
    errors: {
        type: '',
        amount: '',
        category_id: '',
        date: '',
        description: '',
        general: '',
    },
    rules: {
        type: {
            presence: true,
        },
        amount: {
            presence: true
        },
        category_id: {
            presence: true,
        },
        date: {
            presence: true
        }
    },
    get renderPagination() {
        return $array.pagination(this.totalPages, this.pageActive, 2)
    },
    columns: [
        //{name: 'course_id', text:'Course ID'}, 
        { name: 'date', order:'t.transaction_date', text: 'Date' },
        { name: 'type', order:'t.type', text: 'Type' },
        { name: 'category', order:'c.name', text: 'Category' },
        { name: 'amount', order:'t.amount', text: 'Amount' },
        { name: 'description', order:'t.description', text: 'Description' },
    ],
    filter: {
        id: '',
        type: '',
        category: '',
        amount: '',
        description: '',
        date: ''
    },
    nlpPattern:[
        {name: "type", patterns: ["type", "[expense|income]"]},
        {name: "category", patterns: [""]},
        {name: "date", patterns: ["[DATE]"]},
        {name: "amount", patterns: ["[NUMBER]", "NUMBER", "[CARDINAL]"]},
    ],
    sort: {
        column: 't.transaction_date',
        by: 'desc'
    },
    selectType(val) {
        this.form.type = val;
        this.categoryPattern = [];
        this.categories = categoryList.filter(x => {this.categoryPattern.push(x.name); return x.type == val});
        this.categories.push({id:0, icon:'add', organization_id: Vue.store.organization_id, name: 'Add Category', type: val});
        this.form.category_id = 0;
        let pattern = this.nlpPattern.find(x => x.name == 'category');
        pattern.patterns = this.categoryPattern;
        // pattern.patterns = ['[atm|bonus|committee]'];
    },
    selectCategory(val) {
        console.log("categorySelected", val);
        if(val.id === 0){
            Category.add(val.type);
            return;
        }
        this.form.category_id = val.id;
    },
    openForm() {
        this.focusForm();
        this.isFormOpen = !this.isFormOpen;
    },
    reset() {
        this.form.id = null;
        this.selectType('expense');
        this.form.amount = 0;
            // date: currentDate,
        this.form.description = '';

        this.addAmount = false;
    },
    async getPredictedWords() {
        let textField = this.form.description;
        if (textField.includes(' ')) {
            let currentWord = textField.split(' ').pop()
            if (currentWord === '') {
                textField = textField.split(' ')
                textField.pop()
                let previousWord = textField.pop()
                this.wordList = this.service.predict(previousWord.toLowerCase(), 'predict')
            }
            else {
                this.wordList = this.service.predict(currentWord.toLowerCase(), 'complete')
            }
        }
        else {
            this.wordList = this.service.predict(textField.toLowerCase(), 'complete')
        }
        console.log(this.wordList);
    },
    async save() {
        if (this.loader) return false;
        this.success = '';
        this.loader = true;
        this.errors = {
            type: '',
            amount: '',
            category_id: '',
            date: '',
            description: '',
            general: ''
        };

        const result = validate(this.form, this.rules);
        console.log(result);
        if (result !== undefined) {
            this.errors = { ...this.errors, ...result };
            console.log(this.errors);
            notify.error("Error occurred");
            this.loader = false;
            return false;
        }
        let url = 'api/transaction'
        let res;
        if (this.form.id !== null) {
            url = 'api/transaction/' + this.form.id;

            res = await this.api.put(url, this.form);
        } else
            res = await this.api.post(url, this.form);
        if (res.error !== undefined) {
            let err = '';
            if (res.error.description !== undefined) {
                console.log(res.error.description);
                err = res.error.description.toString();
            } else {
                console.log(res.error);
                err = res.error;
            }
            this.errors = { ...this.errors, ...{ "general": err.toString() } };
            notify.error(err.toString());
            this.loader = false;
            return false;
        }
        this.loader = false;
        notify.success('Transaction successfully saved');
        this.reset();
        await this.getList();
    },
    async edit(id) {
        //this.openForm(true);
        notify.info('Loading...', true);
        let res = await this.api.get('api/transaction/' + id);
        if (res.error !== undefined) {
            this.errors = { ...this.errors, ...{ "general": res.error.toString() } };
            notify.error(err.toString());
            return false;
        }
        this.form = {
            id: res.data.id,
            type: res.data.type,
            date: res.data.date,
            category_id: res.data.category_id,
            amount: res.data.amount,
            description: res.data.description
        }
        this.addAmount = true;
        this.isFormOpen = true;
        this.loader = false;
        this.focusForm();
        notify.info('Loading...', false);
    },
    focusForm(){
        window.scrollTo(document.querySelector('#date').offsetTop,0);
    },
    async del(id) {
        if (!confirm("Are you sure, you want to delete this record?"))
            return false;
        if (this.table_loader) return false;
        this.table_loader = true;
        let res = await this.api.delete('api/transaction/' + id);
        if (res.error !== undefined) {
            let err = '';
            if (res.error.description !== undefined) {
                console.log(res.error.description);
                err = res.error.description.toString();
            } else {
                console.log(res.error);
                err = res.error;
            }
            
            notify.error(err.toString());
            this.table_loader = false;
            return false;
        }
        this.table_loader = false;
        notify.success('Record deleted successfully');
        this.reset();
        await this.getList();
    },
    error(err) {
        this.table_error = err;
        setTimeout(() => this.table_error = '', 2000);
        return false;
    },
    ok(success) {
        this.success = success;
        setTimeout(() => this.success = '', 4000);
        return;
    },
    async getList() {
        this.table_loader = true;
        let data = {
            search: this.search,
            offset: (this.pageActive - 1) * this.limitPerPage,
            limit: this.limitPerPage,
            order: this.sort.column,
            order_by: this.sort.by
        };
        let res = await this.api.get('api/transaction', data);
        console.log(res);
        if (res.error !== undefined) {
            this.errors = { ...this.errors, ...{ "general": res.error.toString() } };
            return false;
        }
        this.filteredEntries = res.data.data;
        this.total_amount = res.data.sum;
        this.totalPages = Math.ceil(res.data.total / this.limitPerPage);
        this.pageInfo = {
            from: ((this.pageActive - 1) * this.limitPerPage) + 1,
            to: this.pageActive * (this.limitPerPage > res.data.total ? res.data.total : this.limitPerPage),
            of: res.data.total
        }
        this.table_loader = false;
    },
    init() {
        this.selectType(this.form.type);
        this.getList();
        // Implement a listener for speech segment updates 
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
        this.recognition.lang = 'en-US';
        this.recognition.continuous = true;
        this.recognition.onstart = () => {
            console.log("listning...");
            this.listening = true;
        };
        this.recognition.onresult = (event) => {
            this.audioText = '';
            for(let row of event.results){
                this.audioText += row[0].transcript;
            }
            console.log(event, this.audioText);
            //outputDiv.textContent = transcript;
        };
        this.recognition.onend = () => {
            console.log("listning end",this.nlpPattern);
            this.listening = false;
            const tokens = getTokenValues(this.audioText, this.nlpPattern);
            console.log('tokens', tokens);
            let type;
            let category;
            for(let val of tokens){
                switch(val.type){
                    case 'type':
                        type = val.value;
                        break;
                    case 'category':
                        category = val.value;
                        break;
                    case 'date':
                        let dt = new Date(val.value);
                        console.log(dt);
                        this.form.date= `${dt.getFullYear()}-${('0' + (dt.getMonth()+1)).slice(-2)}-${('0' + dt.getDate()).slice(-2)}`;
                        break;
                    case 'amount':
                        this.form.amount = parseFloat(val.value);
                        break;
                }
            }
            if(type !== undefined && type !== '')
                this.selectType(type.toLowerCase());
            if(category !== undefined && category !== '')
                this.selectCategory(this.categories.find(x => x.name.toLowerCase() == category.toLowerCase()));
            this.form.description = this.audioText;
            this.audioText = '';
        };
    },
    startListening(){
        this.recognition.start();
    },
    stopListening(){
        this.recognition.stop();
    },
    async dataTable(type, val = null){
        switch(type){
            case 'page':
                this.pageActive = val;
                break;
            case 'order':
                this.sort = val;
                break;
            case 'search':
                this.pageActive = 1;
                break;
        }
        await this.getList();
    },
    selectWord(word) {
        let textField = this.form.description;
        let currentWord = textField.split(' ').pop();
        console.log("Current Word", currentWord);
        if (currentWord === '') {
            let wordToAdd = textField + word
            this.form.description = wordToAdd + ' '
            console.log(wordToAdd);
            this.wordList = this.service.predict(word, 'predict')
        }
        else {
            let num_spaces = this.countSpaces(textField)
            let num_words = textField.split(' ').length
            let userWords = ""
            let arrayWords = textField.split(' ')

            for (let i = 0; i < num_words; i++) {
                if (i === num_spaces) {
                    userWords += word
                    break
                }
                userWords += arrayWords[i]
                userWords += ' '
            }
            let predictedWord = userWords.split(' ').pop()
            userWords += ' '
            this.form.description = userWords
            console.log(userWords);
            this.wordList = this.service.predict(predictedWord.trim(), 'predict')
        }
    },
    countSpaces(string) {
        let count = 0
        for (let i = 0; i < string.length; i++) {
            if (string[i] === ' ') {
                count++
            }
        }
        return count
    },
    getPredictAmount(amount = null) {
        if (this.form.amount === null || this.form.amount === 0) {
            this.amountList = {
                10000: '10,000',
                1000: '1,000',
                500: '500',
                100: '100',
                50: '50',
                10: '10'
            };
            this.form.amount = null;
        } else {
            this.amountList = {
                10000: '+10,000',
                1000: '+1,000',
                500: '+500',
                100: '+100',
                50: '+50',
                10: '+10',
                '-10000': '-10,000',
                '-1000': '-1,000',
                '-500': '-500',
                '-100': '-100',
                '-50': '-50',
                '-10': '-10'
            };
        }
    },
    selectAmount(amount) {
        if (this.addAmount) {
            this.form.amount = parseInt(this.form.amount) + parseInt(amount);
        } else
            this.form.amount = parseInt(amount);
        this.addAmount = true;
        this.getPredictAmount(amount);
    }
});
export default Transaction