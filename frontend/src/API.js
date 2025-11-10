const SERVER_URL = 'http://localhost:3000/api';

/* This function executes the login. It wants username and password in a 'credentials' object */
const logIn = async (credentials) => {
    try {
        const response = await fetch(`${SERVER_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // this parameter specifies that authentication cookie must be forwared. It is included in all the authenticated APIs.
            body: JSON.stringify(credentials)
        });
        const validResponse = handleInvalidResponse(response);
        return await validResponse.json();
    } catch (error) {
        console.error('Login error: ', error);
        throw error;
    }
};

function handleInvalidResponse(response) {
    if (!response.ok) { throw Error(response.statusText) }
    let type = response.headers.get('Content-Type');
    if (type !== null && type.indexOf('application/json') === -1){
        throw new TypeError(`Expected JSON, got ${type}`)
    }
    return response;
}

const API = { logIn };
export default API;