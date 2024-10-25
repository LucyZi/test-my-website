const script = document.createElement('script');
script.src = "https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js";
document.head.appendChild(script);


let variableMap = {};
let subjectVariableMap = {};
let currentPage = 1;
const rowsPerPage = 20;
let tableData = [];

async function fetchVariableMap() {
    try {
        const [regularResponse, subjectResponse] = await Promise.all([
            fetch('https://api.census.gov/data/2022/acs/acs5/variables.json'),
            fetch('https://api.census.gov/data/2022/acs/acs5/subject/variables.json')
        ]);
        const regularData = await regularResponse.json();
        const subjectData = await subjectResponse.json();

        if (regularData.variables) {
            variableMap = regularData.variables;
        }
        if (subjectData.variables) {
            subjectVariableMap = subjectData.variables;
        }
    } catch (error) {
        console.error('Error fetching variable map:', error);
    }
}

fetchVariableMap();





// Part 1: Handle form submission in part1.html
if (window.location.pathname.includes("part1.html")) {
    document.getElementById('censusForm').addEventListener('submit', function(event) {
        event.preventDefault();
        document.getElementById('error').innerHTML = '';
        document.getElementById('searchButton').classList.add('active');

        const street = document.getElementById('street').value;
        const city = document.getElementById('city').value;
        const state = document.getElementById('state').value;
        const zip = document.getElementById('zip').value;

        // Store data in sessionStorage
        sessionStorage.setItem('street', street);
        sessionStorage.setItem('city', city);
        sessionStorage.setItem('state', state);
        sessionStorage.setItem('zip', zip);

        // 显示 part2Iframe
        const part2Iframe = parent.document.getElementById('part2Iframe');
        if (part2Iframe) {
            part2Iframe.style.display = "block"; // 显示 part2Iframe
            part2Iframe.contentWindow.location.reload(); // 重新加载 part2.html 内容
        }

    });
}

// Part 2: Fetch data and display results in part2.html
if (window.location.pathname.includes("part2.html")) {
    window.onload = function() {
        const street = sessionStorage.getItem('street');
        const city = sessionStorage.getItem('city');
        const state = sessionStorage.getItem('state');
        const zip = sessionStorage.getItem('zip');

        if (street && city && state && zip) {
            // Construct API URL and create a JSONP request
            const apiUrl = `https://geocoding.geo.census.gov/geocoder/geographies/address?street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&zip=${encodeURIComponent(zip)}&benchmark=Public_AR_Current&vintage=Current_Current&format=jsonp&callback=parseResponse`;
            const script = document.createElement('script');
            script.src = apiUrl;
            document.body.appendChild(script);
        } else {
            console.error("Missing address data in sessionStorage");
        }
    };
}


function parseResponse(data) {
    if (data.result.addressMatches && data.result.addressMatches.length > 0) {
        if (data.result.addressMatches[0].geographies && data.result.addressMatches[0].geographies["Census Tracts"]) {
            const censusTractData = data.result.addressMatches[0].geographies["Census Tracts"][0];
            const stateFips = censusTractData.STATE;
            const countyFips = censusTractData.COUNTY;
            const tract = censusTractData.TRACT;

            // 将 tract 显示在表格上方
            document.getElementById('tractInfo').innerHTML = `Your census tract number is: ${tract}`;

            // 先加载 AcsData，再加载 SubjectAcsData
            fetchAcsData(tract, stateFips, countyFips)
                .then(() => fetchSubjectAcsData(tract, stateFips, countyFips))
                .catch(error => console.error("Error fetching data:", error));
        } else {
            document.getElementById('error').innerHTML = 'Census tract data not available.';
        }
    } else {
        document.getElementById('error').innerHTML = 'No address matches found.';
    }
}





function fetchAcsData(tract, stateFips, countyFips) {
    return new Promise((resolve, reject) => {
        const apiKey = 'a3e835fbeb3e5f5985e92d4426648b3057197357';
        const groups = ['B25077', 'B25035', 'B25002', 'B19122', 'B19083'];
        const groupNames = {
            'B25077': 'House median value ($)',       // 替换后的名字
            'B25035': 'Median year structure built',  // 替换后的名字
            'B25002': 'Total houses',                 // 替换后的名字
            'B19122': 'Families',                     // 替换后的名字
            'B19083': 'Gini index (0 perfect equality; 1 maximal inequality; US 0.47)'  // 替换后的名字
        };

        tableData = []; // 清空表格数据
        const requests = groups.map(group => {
            return $.getJSON(`https://api.census.gov/data/2022/acs/acs5?get=NAME,group(${group})&for=tract:${tract}&in=state:${stateFips}%20county:${countyFips}&key=${apiKey}`);
        });

        $.when(...requests).done((...responses) => {
            responses.forEach((response, index) => {
                const [data] = response;
                let groupName = groupNames[groups[index]];
                if (data.length > 1) {
                    data.slice(1).forEach(row => {
                        for (let i = 1; i < row.length - 1; i++) {
                            const variableCode = data[0][i];
                            let variableName = variableMap[variableCode] ? variableMap[variableCode].label : null;
                            if (variableName && variableName !== "Geography") {
                                // 替换特定变量名
                                variableName = variableName.replace(/^Estimate!!/, '').replace(/!!/g, ' ');

                                // 根据特定名称进一步替换
                                if (variableName === 'Median value (dollars)') {
                                    variableName = 'House median value ($)';
                                } else if (variableName === 'Median year structure built') {
                                    variableName = 'Median year structure built';
                                } else if (variableName === 'Total:' && groupName === 'Total houses') {
                                    variableName = 'Total houses';
                                } else if (variableName === 'Total: Occupied') {
                                    variableName = 'Total occupied houses';
                                } else if (variableName === 'Total: Vacant') {
                                    variableName = 'Total vacant houses';
                                } else if (variableName === 'Total:' && groupName === 'Families') {
                                    variableName = 'Total families';
                                } else if (variableName === 'Total: No earners') {
                                    variableName = 'Families: No earners';
                                } else if (variableName === 'Total: 1 earner') {
                                    variableName = 'Families: 1 earner';
                                } else if (variableName === 'Total: 2 earners') {
                                    variableName = 'Families: 2 earners';
                                } else if (variableName === 'Total: 3 or more earners') {
                                    variableName = 'Families: 3 or more earners';
                                } else if (variableName === 'Gini Index') {
                                    variableName = 'Gini index (0 perfect equality; 1 maximal inequality; US 0.47)';
                                }

                                let value = row[i];

                                // 如果数值是 -888888888，显示为 (X)
                                if (value === "-888888888") {
                                    value = "(X)";
                                } 
                                // 处理 -666666666 的情况
                                else if (value === "-666666666") {
                                    value = "—";
                                } 
                                // 正常数值处理
                                else if (!isNaN(value)) {
                                    const numericValue = parseFloat(value);
                                    if (numericValue % 1 !== 0) {
                                        value = numericValue.toFixed(4); // 保留4位小数
                                    } else {
                                        value = numericValue.toLocaleString(); // 千分位格式化
                                    }
                                }

                                tableData.push({
                                    variableName,
                                    value
                                });
                            }
                        }
                    });
                }
            });

            updateTable();
            resolve(); // AcsData 加载完成，resolve 以便执行下一个操作
        }).fail((jqxhr, textStatus, error) => {
            reject(error); // 发生错误时调用 reject
        });
    });
}






function fetchSubjectAcsData(tract, stateFips, countyFips) { 
    const apiKey = 'a3e835fbeb3e5f5985e92d4426648b3057197357'; 
    const group = 'S0601'; 
    const groupName = 'Selected Characteristics of the Total and Native Populations in the United States';

    const incomeLimitVars = [
        "Total: INDIVIDUALS' INCOME IN THE PAST 12 MONTHS (IN 2022 INFLATION-ADJUSTED DOLLARS): Population 15 years and over",
        "Total: INDIVIDUALS' INCOME IN THE PAST 12 MONTHS (IN 2022 INFLATION-ADJUSTED DOLLARS): Population 15 years and over: Median income (dollars)",
        "Native; born in state of residence: INDIVIDUALS' INCOME IN THE PAST 12 MONTHS (IN 2022 INFLATION-ADJUSTED DOLLARS): Population 15 years and over",
        "Native; born in state of residence: INDIVIDUALS' INCOME IN THE PAST 12 MONTHS (IN 2022 INFLATION-ADJUSTED DOLLARS): Population 15 years and over: Median income (dollars)",
        "Native; born in other state in the U.S.: INDIVIDUALS' INCOME IN THE PAST 12 MONTHS (IN 2022 INFLATION-ADJUSTED DOLLARS): Population 15 years and over",
        "Native; born in other state in the U.S.: INDIVIDUALS' INCOME IN THE PAST 12 MONTHS (IN 2022 INFLATION-ADJUSTED DOLLARS): Population 15 years and over: Median income (dollars)",
        "Native; born outside U.S.: INDIVIDUALS' INCOME IN THE PAST 12 MONTHS (IN 2022 INFLATION-ADJUSTED DOLLARS): Population 15 years and over",
        "Native; born outside U.S.: INDIVIDUALS' INCOME IN THE PAST 12 MONTHS (IN 2022 INFLATION-ADJUSTED DOLLARS): Population 15 years and over: Median income (dollars)"
    ];

    const noPercentageVars = [
        'Total: Total population',
        'Total: LANGUAGE SPOKEN AT HOME AND ABILITY TO SPEAK ENGLISH: Population 5 years and over',
        'Total: MARITAL STATUS: Population 15 years and over',
        'Total: EDUCATIONAL ATTAINMENT: Population 25 years and over',
        'Total: POVERTY STATUS IN THE PAST 12 MONTHS: Population for whom poverty status is determined',
        'Native; born in state of residence: Total population',
        'Native; born in state of residence: LANGUAGE SPOKEN AT HOME AND ABILITY TO SPEAK ENGLISH: Population 5 years and over',
        'Native; born in state of residence: MARITAL STATUS: Population 15 years and over',
        'Native; born in state of residence: EDUCATIONAL ATTAINMENT: Population 25 years and over',
        'Native; born in state of residence: POVERTY STATUS IN THE PAST 12 MONTHS: Population for whom poverty status is determined',
        'Native; born in other state in the U.S.: Total population',
        'Native; born in other state in the U.S.: LANGUAGE SPOKEN AT HOME AND ABILITY TO SPEAK ENGLISH: Population 5 years and over',
        'Native; born in other state in the U.S.: MARITAL STATUS: Population 15 years and over',
        'Native; born in other state in the U.S.: EDUCATIONAL ATTAINMENT: Population 25 years and over',
        'Native; born in other state in the U.S.: POVERTY STATUS IN THE PAST 12 MONTHS: Population for whom poverty status is determined',
        'Native; born outside U.S.: Total population',
        'Native; born outside U.S.: LANGUAGE SPOKEN AT HOME AND ABILITY TO SPEAK ENGLISH: Population 5 years and over',
        'Native; born outside U.S.: MARITAL STATUS: Population 15 years and over',
        'Native; born outside U.S.: EDUCATIONAL ATTAINMENT: Population 25 years and over',
        'Native; born outside U.S.: POVERTY STATUS IN THE PAST 12 MONTHS: Population for whom poverty status is determined'
    ];

    const medianAgeVars = [
        'Total: Total population: AGE: Median age (years)',
        'Native; born in state of residence: Total population: AGE: Median age (years)',
        'Native; born in other state in the U.S.: Total population: AGE: Median age (years)',
        'Native; born outside U.S.: Total population: AGE: Median age (years)'
    ];

    $.getJSON(`https://api.census.gov/data/2022/acs/acs5/subject?get=NAME,group(${group})&for=tract:${tract}&in=state:${stateFips}%20county:${countyFips}&key=${apiKey}`, (data) => {
        if (data.length > 1) {
            data.slice(1).forEach(row => {
                for (let i = 1; i < row.length - 1; i++) {
                    const variableCode = data[0][i];
                    let variableName = subjectVariableMap[variableCode] ? subjectVariableMap[variableCode].label : null;
                    if (variableName && variableName !== "Geography") {
                        variableName = variableName.replace(/^Estimate!!/, '').replace(/!!/g, ': ');
                        let value = row[i];

                        if (value === "-888888888") {
                            value = "(X)";
                        } else if (value === "-666666666") {
                            value = "—";
                        } else if (incomeLimitVars.includes(variableName)) {
                            if (!isNaN(value) && parseFloat(value) > 250000) {
                                value = "250,000+";
                            } else if (!isNaN(value)) {
                                const numericValue = parseFloat(value);
                                value = numericValue % 1 === 0 ? numericValue.toLocaleString() : numericValue.toFixed(1);
                            }
                        } else if (noPercentageVars.includes(variableName)) {
                            if (!isNaN(value)) {
                                const numericValue = parseFloat(value);
                                value = numericValue % 1 === 0 ? numericValue.toLocaleString() : numericValue.toFixed(1);
                            }
                        } else if (medianAgeVars.includes(variableName)) {
                            if (!isNaN(value)) {
                                const numericValue = parseFloat(value);
                                value = numericValue.toFixed(1).toLocaleString();
                            }
                        } else {
                            if (!isNaN(value)) {
                                const numericValue = parseFloat(value);
                                value = numericValue.toFixed(1) + "%";
                            }
                        }

                        tableData.push({
                            tract,
                            groupName,
                            variableName,
                            value
                        });
                    }
                }
            });
            updateTable();
        }
    }).fail(function (jqxhr, textStatus, error) {
        console.error("Request Failed: " + error);
    });
}



function updateTable() {
    const tableBody = $('#resultsTable tbody');
    tableBody.empty();
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = tableData.slice(start, end);

    pageData.forEach(row => {
        const tableRow = `<tr>
            <td>${row.variableName}</td>
            <td>${row.value}</td>
        </tr>`;
        tableBody.append(tableRow);
    });

    $('#resultsTable').show();
    $('#searchCount').text(`Search Results: ${tableData.length}`).show();
    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(tableData.length / rowsPerPage);
    const paginationDiv = $('#pagination');
    paginationDiv.empty();

    for (let i = 1; i <= totalPages; i++) {
        const button = $(`<button>${i}</button>`);
        button.css('display', 'inline-block');
        if (i === currentPage) {
            button.addClass('active');
        }
        button.click(() => {
            currentPage = i;
            updateTable();
        });
        paginationDiv.append(button);
    }
}
