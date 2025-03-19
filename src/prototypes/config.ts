/*
Currently the user is not forced/asked to provide an tempo api key and also not to provide a url to their profile in jira.

So the user can start tracking without any configuration, this not a problem in itself but it is a problem when the user wants to use the pulse feature.
So we want to ask the user to provide the tempo api key and the url to their profile in jira when they want to use the pulse feature.


maybe we should unify settings the api key and jira url in a setup command, so we just need to ask the user if they want to setup first before they start tracking.

Also make it really clear to the user that the pulse feature is only available when they have performed the setup command.
We want to keep track of the setup state by looking if the api key and jira url is set in the configuration.
*/
